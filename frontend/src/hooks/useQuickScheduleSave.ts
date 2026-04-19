import React from 'react';
import { dispatchers } from '../events/dispatchers';
import type { Appointment } from '../hooks/useAppointments';
import { useAgendaSettings } from './useAgendaSettings';
import { AUTO_CLOSE_QUICK_SCHEDULE_ON_CREATE } from '../config/limits';
import { API_BASE } from '../config/api';
import { track } from '../utils/telemetry';
import { buildDeviceHeaders } from '../services/device';
import ensureDeviceSession from '../services/sessions';
import { pad2, toMinutes, fromMinutes } from '../utils/hmTime';
import { openPendingActionsForAppointment } from '../utils/appointments/openPendingActions';

export interface UseQuickScheduleSaveParams {
    selectedDate: Date;
    startHM: string;
    endHM: string;
    visitType: string;
    notes: string;
    clientId: number;
    currentEdit: Appointment | null;
    afterPersist?: (id?: number, action?: 'created' | 'updated') => void;
    /** Called after a successful save with the updated id and whether it was an edit. */
    onSuccess: (updatedId: number | undefined, wasEdit: boolean) => void;
    /** Called to close the modal immediately (e.g. after auto-close on create). */
    onImmediateClose: () => void;
    emitGlobalErrorMessage?: boolean;
}

export function useQuickScheduleSave({
    selectedDate,
    startHM,
    endHM,
    visitType,
    notes,
    clientId,
    currentEdit,
    afterPersist,
    onSuccess,
    onImmediateClose,
    emitGlobalErrorMessage = true,
}: UseQuickScheduleSaveParams): {
    saving: boolean;
    error: string | null;
    clearError: () => void;
    handleSave: () => Promise<void>;
} {
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const agendaSettings = useAgendaSettings();

    const clearError = React.useCallback(() => setError(null), []);

    const handleSave = React.useCallback(async () => {
        setError(null);
        setSaving(true);
        const t0 = performance.now();

        const slot = agendaSettings.slotInterval;
        function snapIfNeeded(hm: string): string {
            const [h, m] = hm.split(':').map(n => parseInt(n, 10));
            if (isNaN(h) || isNaN(m)) return hm;
            const snapped = Math.round(m / slot) * slot;
            const finalM = Math.min(59, Math.max(0, snapped));
            return `${pad2(h)}:${pad2(finalM)}`;
        }

        const normalizedStartHM = snapIfNeeded(startHM);
        let normalizedEndHM = snapIfNeeded(endHM);
        if (toMinutes(normalizedEndHM) <= toMinutes(normalizedStartHM)) {
            const mins =
                toMinutes(normalizedStartHM) + agendaSettings.defaultDuration;
            normalizedEndHM = fromMinutes(mins);
        }

        const MAX_MINUTE = 23 * 60 + 59;
        const startMin = Math.max(
            0,
            Math.min(MAX_MINUTE, toMinutes(normalizedStartHM)),
        );
        let endMin = Math.max(
            0,
            Math.min(MAX_MINUTE, toMinutes(normalizedEndHM)),
        );
        if (endMin <= startMin) endMin = Math.min(MAX_MINUTE, startMin + 1);

        const baseDate = new Date(selectedDate);
        const startDate = new Date(baseDate);
        startDate.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
        const endDate = new Date(baseDate);
        endDate.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);
        const startISO = startDate.toISOString();
        const endISO = endDate.toISOString();

        const visitTitles: Record<string, string> = {
            consulta: 'Consulta',
            avaliacao: 'Avaliação',
            retorno: 'Retorno',
            procedimento: 'Serviço',
            outro: 'Outro',
        };
        const title = visitTitles[String(visitType)] || 'Consulta';
        const token = localStorage.getItem('accessToken') || '';
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            let updatedId: number | undefined;
            const wasEdit = !!currentEdit;

            if (currentEdit) {
                const resp = await fetch(
                    `${API_BASE}/agenda/appointments/${currentEdit.id}/`,
                    {
                        method: 'PATCH',
                        headers,
                        body: JSON.stringify({
                            title,
                            start_at: startISO,
                            end_at: endISO,
                            visit_type: visitType,
                            notes,
                        }),
                    },
                );
                if (!resp.ok) throw new Error('Erro ao atualizar');
                updatedId = currentEdit.id;
            } else {
                try {
                    await ensureDeviceSession();
                } catch {
                    /* noop */
                }

                let resp = await fetch(`${API_BASE}/agenda/appointments/`, {
                    method: 'POST',
                    headers: { ...headers, ...buildDeviceHeaders() },
                    body: JSON.stringify({
                        client: clientId,
                        title,
                        start_at: startISO,
                        end_at: endISO,
                        visit_type: visitType,
                        status: 'scheduled',
                        notes,
                    }),
                });

                if (resp.status === 401 || resp.status === 403) {
                    try {
                        await ensureDeviceSession(true);
                    } catch {
                        /* noop */
                    }
                    resp = await fetch(`${API_BASE}/agenda/appointments/`, {
                        method: 'POST',
                        headers: { ...headers, ...buildDeviceHeaders() },
                        body: JSON.stringify({
                            client: clientId,
                            title,
                            start_at: startISO,
                            end_at: endISO,
                            visit_type: visitType,
                            status: 'scheduled',
                            notes,
                        }),
                    });
                }

                if (!resp.ok) {
                    let text = '';
                    try {
                        const ct = resp.headers.get('Content-Type') || '';
                        if (ct.includes('application/json')) {
                            const j = await resp.json();
                            text =
                                typeof j === 'string' ? j : JSON.stringify(j);
                        } else {
                            text = await resp.text();
                        }
                    } catch {
                        /* ignore */
                    }

                    // If backend indicates pending, open resolver
                    if (/pendente/i.test(text)) {
                        try {
                            const token2 =
                                localStorage.getItem('accessToken') || '';
                            const headers2: Record<string, string> = {};
                            if (token2)
                                headers2['Authorization'] = `Bearer ${token2}`;
                            const url = `${API_BASE}/agenda/appointments/?client=${clientId}&status=scheduled&ordering=-end_at&limit=50&ts=${Date.now()}`;
                            const r = await fetch(url, {
                                headers: headers2,
                                cache: 'no-store',
                            });
                            if (r.ok) {
                                const data = (await r.json()) as Appointment[];
                                const nowMs = Date.now();
                                const pending = Array.isArray(data)
                                    ? data.find(ap => {
                                          const endMs = new Date(
                                              ap.end_at,
                                          ).getTime();
                                          return (
                                              ap.status === 'scheduled' &&
                                              isFinite(endMs) &&
                                              endMs <= nowMs
                                          );
                                      })
                                    : null;
                                if (pending) {
                                    try {
                                        const a = pending as Appointment;
                                        const anyAppt = a as unknown as Record<
                                            string,
                                            unknown
                                        >;
                                        const clientName = (():
                                            | string
                                            | undefined => {
                                            if (
                                                typeof anyAppt.client_name ===
                                                'string'
                                            )
                                                return anyAppt.client_name as string;
                                            const c = anyAppt.client as unknown;
                                            if (
                                                c &&
                                                typeof c === 'object' &&
                                                'name' in
                                                    (c as Record<
                                                        string,
                                                        unknown
                                                    >)
                                            ) {
                                                const n = (
                                                    c as { name?: unknown }
                                                ).name;
                                                if (typeof n === 'string')
                                                    return n;
                                            }
                                            return undefined;
                                        })();
                                        const clientField = ((): unknown => {
                                            const c = anyAppt.client as unknown;
                                            if (
                                                typeof c === 'number' ||
                                                typeof c === 'object'
                                            )
                                                return c;
                                            return undefined;
                                        })();
                                        openPendingActionsForAppointment(a);
                                    } catch {
                                        /* noop */
                                    }
                                    try {
                                        window.dispatchEvent(
                                            new CustomEvent('systemMessage', {
                                                detail: {
                                                    text: 'Há uma pendência anterior. Resolva-a antes de criar um novo compromisso.',
                                                    type: 'warning',
                                                },
                                            }),
                                        );
                                    } catch {
                                        /* noop */
                                    }
                                }
                            }
                        } catch {
                            /* ignore */
                        }
                    }

                    const friendly = (() => {
                        if (!text) return 'Erro ao salvar. Tente novamente.';
                        try {
                            const parsed = JSON.parse(text);
                            if (parsed?.non_field_errors?.length) {
                                const msg: string = parsed.non_field_errors[0];
                                if (/conflito/i.test(msg))
                                    return 'Existe um compromisso neste período. Toque no cartão destacado para remover o conflito ajustando data/hora ou cancelando o compromisso.';
                                return msg;
                            }
                            const firstField = Object.values(parsed).find(
                                v => Array.isArray(v) && v.length,
                            ) as string[] | undefined;
                            if (firstField) return firstField[0];
                            if (typeof parsed.detail === 'string')
                                return parsed.detail;
                        } catch {
                            /* not JSON */
                        }
                        return text.length < 200
                            ? text
                            : 'Erro ao salvar. Tente novamente.';
                    })();
                    throw new Error(friendly);
                }

                const data = (await resp.json()) as { id?: number };
                updatedId = data?.id;
            }

            try {
                window.dispatchEvent(
                    new CustomEvent('systemMessage', {
                        detail: {
                            text: wasEdit
                                ? 'Compromisso atualizado'
                                : 'Compromisso criado',
                            type: 'success',
                        },
                    }),
                );
            } catch {
                /* noop */
            }

            try {
                dispatchers.updateClients();
                dispatchers.appointmentsChanged();
                try {
                    window.dispatchEvent(
                        new Event('appointments:maybeRefresh'),
                    );
                } catch {
                    /* noop */
                }
            } catch {
                /* noop */
            }

            onSuccess(updatedId, wasEdit);
            if (afterPersist)
                afterPersist(updatedId, wasEdit ? 'updated' : 'created');

            try {
                if (!wasEdit && updatedId) {
                    track({
                        type: 'appointment_created',
                        payload: {
                            id: updatedId,
                            client_id: clientId,
                            start_at: startISO,
                        },
                    });
                } else if (wasEdit && updatedId) {
                    track({
                        type: 'appointment_updated',
                        payload: { id: updatedId, start_at: startISO },
                    });
                }
            } catch {
                /* noop */
            }

            if (!wasEdit && AUTO_CLOSE_QUICK_SCHEDULE_ON_CREATE) {
                try {
                    window.dispatchEvent(new Event('ensureScrollUnlocked'));
                } catch {
                    /* noop */
                }
                setTimeout(() => {
                    try {
                        window.dispatchEvent(new Event('clients:forceRefresh'));
                    } catch {
                        /* noop */
                    }
                    onImmediateClose();
                }, 160);
            }
        } catch (e) {
            const msg =
                e && typeof e === 'object' && 'message' in e
                    ? String((e as Error).message)
                    : 'Erro ao salvar';
            setError(msg);
            if (emitGlobalErrorMessage) {
                try {
                    window.dispatchEvent(
                        new CustomEvent('systemMessage', {
                            detail: { text: msg, type: 'error' },
                        }),
                    );
                } catch {
                    /* noop */
                }
            }
        } finally {
            setSaving(false);
            const t1 = performance.now();
            console.debug(
                '[QuickSchedule] handleSave latency ms',
                (t1 - t0).toFixed(1),
            );
            try {
                window.dispatchEvent(new Event('ensureScrollUnlocked'));
            } catch {
                /* noop */
            }
        }
    }, [
        selectedDate,
        startHM,
        endHM,
        visitType,
        notes,
        currentEdit,
        clientId,
        afterPersist,
        onSuccess,
        onImmediateClose,
        emitGlobalErrorMessage,
        agendaSettings.defaultDuration,
        agendaSettings.slotInterval,
    ]);

    // Timeout guard: abort save after 20 s to avoid stuck spinner
    React.useEffect(() => {
        if (!saving) return;
        const id = window.setTimeout(() => {
            setSaving(false);
            setError(
                prev =>
                    prev ||
                    'Operação demorou demais. Verifique conexão e tente novamente.',
            );
            try {
                window.dispatchEvent(new Event('ensureScrollUnlocked'));
            } catch {
                /* noop */
            }
        }, 20000);
        return () => window.clearTimeout(id);
    }, [saving]);

    return { saving, error, clearError, handleSave };
}
