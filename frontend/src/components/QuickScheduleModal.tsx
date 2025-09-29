import React from 'react';
import { dispatchers } from '../events/dispatchers';
import AppModal from './Modal';
import TimePicker10 from './TimePicker10';
import FloatingDatePicker from './FloatingDatePicker';
import QuickScheduleHeader from './quickschedule/QuickScheduleHeader';
import QuickScheduleDayList, {
    type DayFilter,
} from './quickschedule/QuickScheduleDayList';
import PendingActionsModal from './PendingActionsModal';
import ensureDeviceSession from '../services/sessions';
import type { ClientBasic } from '../types/ClientBasic';
import type { Appointment } from '../hooks/useAppointments';
import { useAppointmentsRange } from '../hooks/useAppointments';
import { getNow } from '../utils/now';
import {
    getSlotInterval,
    getWorkTimes,
    getDefaultDuration,
} from '../utils/agendaSettings';
import { AUTO_CLOSE_QUICK_SCHEDULE_ON_CREATE } from '../config/limits';
import { API_BASE } from '../config/api';
import { track } from '../utils/telemetry';
import { buildDeviceHeaders } from '../services/device';
import { usePendingGuard } from '../hooks/usePendingGuard';

type VisitType = Appointment['visit_type'];
type ClientMaybeNext = ClientBasic & { next_appointment_id?: number };

interface QuickScheduleModalProps {
    open: boolean;
    onClose: () => void;
    client: ClientBasic;
    editAppointment?: Appointment | null;
    afterPersist?: (id?: number, action?: 'created' | 'updated') => void;
    futureAppointments?: Array<unknown>;
    maxFutureAppointments?: number;
}

function pad2(n: number) {
    return String(n).padStart(2, '0');
}
function toMinutes(hm: string): number {
    const [h, m] = hm.split(':').map(s => parseInt(s || '0', 10));
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}
function fromMinutes(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${pad2(h)}:${pad2(m)}`;
}
function weekdayLabel(d: Date) {
    const s = d
        .toLocaleDateString('pt-BR', { weekday: 'short' })
        .replace('.', '');
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function QuickScheduleModal({
    open,
    onClose,
    client,
    editAppointment,
    afterPersist,
}: QuickScheduleModalProps) {
    const isEdit = !!editAppointment;
    const [selectedDate, setSelectedDate] = React.useState<Date>(() => {
        if (isEdit && editAppointment)
            return new Date(editAppointment.start_at);
        const base = getNow();
        base.setMinutes(base.getMinutes() + 60);
        return base;
    });
    const [startHM, setStartHM] = React.useState<string>(() => {
        if (isEdit && editAppointment) {
            const d = new Date(editAppointment.start_at);
            return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
        }
        const d = new Date(selectedDate);
        return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    });
    const [endHM, setEndHM] = React.useState<string>(() => {
        if (isEdit && editAppointment) {
            const d = new Date(editAppointment.end_at);
            return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
        }
        const mins = toMinutes(startHM) + getDefaultDuration();
        return fromMinutes(mins);
    });
    const [visitType, setVisitType] = React.useState<VisitType>(
        (isEdit && editAppointment
            ? editAppointment.visit_type
            : 'consulta') as VisitType,
    );
    const [setDefaultVisitType, setSetDefaultVisitType] = React.useState(false);
    const [notes, setNotes] = React.useState<string>(
        (isEdit && editAppointment && editAppointment.notes) || '',
    );
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [reloadKey, setReloadKey] = React.useState(0);
    const [currentEdit, setCurrentEdit] = React.useState<Appointment | null>(
        editAppointment || null,
    );
    const [lastEditedId, setLastEditedId] = React.useState<number | null>(null);
    const [highlightId, setHighlightId] = React.useState<number | null>(null);
    const [editingHighlightId, setEditingHighlightId] = React.useState<
        number | null
    >(currentEdit?.id ?? null);
    const [showPicker, setShowPicker] = React.useState(false);
    const listRef = React.useRef<HTMLDivElement | null>(null);
    const workTimes = getWorkTimes();

    // Day range for list
    const dayStart = React.useMemo(() => {
        const d = new Date(selectedDate);
        d.setHours(0, 0, 0, 0);
        return d;
    }, [selectedDate]);
    const dayEnd = React.useMemo(() => {
        const d = new Date(dayStart);
        d.setDate(d.getDate() + 1);
        return d;
    }, [dayStart]);

    const { items: dayAppointments, loading: dayLoading } =
        useAppointmentsRange(dayStart, dayEnd, client.id, reloadKey);

    const [dayFilter, setDayFilter] = React.useState<DayFilter>('todos');

    // Title helpers
    const subtitleAgenda = React.useMemo(() => {
        const dateStr = selectedDate.toLocaleDateString('pt-BR');
        return `${weekdayLabel(selectedDate)}, ${dateStr}`;
    }, [selectedDate]);
    const sectionDateTitle = React.useMemo(() => {
        const d = selectedDate;
        const dd = `${pad2(d.getDate())}/${pad2(
            d.getMonth() + 1,
        )}/${d.getFullYear()}`;
        return `${weekdayLabel(d)} — ${dd}`;
    }, [selectedDate]);

    // Pending guard (block create when client has pending)
    const { found: pendingFound, refresh: refreshPendingGuard } =
        usePendingGuard({
            open,
            isEdit,
            clientId: client.id,
        });
    const isPending = !!pendingFound;
    const [pendingOpen, setPendingOpen] = React.useState(false);
    const [pendingAppt, setPendingAppt] = React.useState<Appointment | null>(
        null,
    );
    React.useEffect(() => {
        if (!dayLoading && lastEditedId) {
            const exists = dayAppointments.some(a => a.id === lastEditedId);
            if (exists) {
                setHighlightId(lastEditedId);
                requestAnimationFrame(() => {
                    try {
                        const el = document.getElementById(
                            `appt-card-${lastEditedId}`,
                        );
                        if (el && el.scrollIntoView)
                            el.scrollIntoView({ block: 'center' });
                    } catch {
                        /* noop */
                    }
                });
                const t = window.setTimeout(() => setHighlightId(null), 2500);
                return () => window.clearTimeout(t);
            }
        }
        return;
    }, [dayLoading, lastEditedId, dayAppointments]);

    // Recarrega a lista do dia quando houver mudanças externas de compromissos
    React.useEffect(() => {
        if (!open) return;
        const onChanged = () => setReloadKey(k => k + 1);
        window.addEventListener('appointments:changed', onChanged);
        return () =>
            window.removeEventListener('appointments:changed', onChanged);
    }, [open]);

    function buildDateStr(d: Date) {
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(
            d.getDate(),
        )}`;
    }

    const handleImmediateClose = React.useCallback(() => {
        try {
            window.dispatchEvent(new Event('ensureScrollUnlocked'));
        } catch {
            /* noop */
        }
        try {
            refreshPendingGuard();
        } catch {
            /* noop */
        }
        onClose();
    }, [onClose, refreshPendingGuard]);

    const handleSave = React.useCallback(async () => {
        setError(null);
        setSaving(true);
        const t0 = performance.now();
        const dateStr = buildDateStr(selectedDate);
        const startISO = new Date(`${dateStr}T${startHM}:00`).toISOString();
        const endISO = new Date(`${dateStr}T${endHM}:00`).toISOString();
        const visitTitles: Record<string, string> = {
            consulta: 'Consulta',
            avaliacao: 'Avaliação',
            retorno: 'Retorno',
            procedimento: 'Procedimento',
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
                // Ensure device session exists before POST create
                try {
                    await ensureDeviceSession();
                } catch {
                    /* noop */
                }
                let resp = await fetch(`${API_BASE}/agenda/appointments/`, {
                    method: 'POST',
                    headers: { ...headers, ...buildDeviceHeaders() },
                    body: JSON.stringify({
                        client: client.id,
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
                            client: client.id,
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
                            const url = `${API_BASE}/agenda/appointments/?client=${
                                client.id
                            }&status=scheduled&ordering=-end_at&limit=50&ts=${Date.now()}`;
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
                                    setPendingAppt(pending);
                                    setPendingOpen(true);
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
                    const friendly =
                        text && text.length < 400 ? text : 'Erro ao criar';
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
                // Dispara imediatamente e também agenda via dispatcher para coalescer com outros eventos próximos
                dispatchers.updateClients();
                dispatchers.appointmentsChanged();
                // Sinal adicional opcional: nudge 'appointments:maybeRefresh' para hooks que escutam pings leves
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

            setReloadKey(k => k + 1);
            if (updatedId) setLastEditedId(updatedId);
            if (afterPersist)
                afterPersist(updatedId, wasEdit ? 'updated' : 'created');

            try {
                if (!wasEdit && updatedId) {
                    track({
                        type: 'appointment_created',
                        payload: {
                            id: updatedId,
                            client_id: client.id,
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
                        // Mantemos forceRefresh direto (uso específico), mas coalescemos eventos globais
                        window.dispatchEvent(new Event('clients:forceRefresh'));
                    } catch {
                        /* noop */
                    }
                    handleImmediateClose();
                }, 160);
            }
        } catch (e) {
            const msg =
                e && typeof e === 'object' && 'message' in e
                    ? String((e as Error).message)
                    : 'Erro ao salvar';
            setError(msg);
            try {
                window.dispatchEvent(
                    new CustomEvent('systemMessage', {
                        detail: { text: msg, type: 'error' },
                    }),
                );
            } catch {
                /* noop */
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
        client.id,
        afterPersist,
        handleImmediateClose,
    ]);

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

    return (
        <AppModal
            open={open}
            onClose={handleImmediateClose}
            closeOnEnter={false}
            fullScreen
            maxHeightVh={96}
            actionsBarStyle={{
                background: 'transparent',
                borderBottom: 'none',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    position: 'relative',
                    maxWidth: 'min(1600px, 96vw)',
                    margin: '0 auto',
                }}
            >
                <QuickScheduleHeader
                    isEdit={!!currentEdit}
                    clientFullName={`${client.first_name} ${client.last_name}`}
                    subtitleAgenda={subtitleAgenda}
                    onToggleDatePicker={() => setShowPicker(v => !v)}
                />

                {!isEdit && isPending && (
                    <div
                        style={{
                            background: '#f3f4f6',
                            border: '1px solid #d1d5db',
                            color: '#374151',
                            padding: '8px 10px',
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                        }}
                    >
                        <div>
                            <strong>Atenção:</strong> há um compromisso pendente
                            para este cliente. Finalize-o antes de criar um
                            novo.
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                onClick={async () => {
                                    try {
                                        const id = (pendingFound?.id ||
                                            (client as ClientMaybeNext)
                                                .next_appointment_id) as
                                            | number
                                            | undefined;
                                        if (!id) {
                                            try {
                                                window.dispatchEvent(
                                                    new CustomEvent(
                                                        'scrollToClientCard',
                                                        {
                                                            detail: {
                                                                clientId:
                                                                    client.id,
                                                            },
                                                        },
                                                    ),
                                                );
                                            } catch {
                                                /* noop */
                                            }
                                            return;
                                        }
                                        const token =
                                            localStorage.getItem('accessToken');
                                        const headers: Record<string, string> =
                                            {
                                                'Content-Type':
                                                    'application/json',
                                            };
                                        if (token)
                                            headers[
                                                'Authorization'
                                            ] = `Bearer ${token}`;
                                        const resp = await fetch(
                                            `${API_BASE}/agenda/appointments/${id}/`,
                                            { headers },
                                        );
                                        if (!resp.ok)
                                            throw new Error(
                                                'Falha ao carregar compromisso pendente',
                                            );
                                        const appt =
                                            (await resp.json()) as Appointment;
                                        setPendingAppt(appt);
                                        setPendingOpen(true);
                                    } catch (e) {
                                        const msg =
                                            e &&
                                            typeof e === 'object' &&
                                            'message' in e
                                                ? String((e as Error).message)
                                                : 'Erro ao abrir pendência';
                                        try {
                                            window.dispatchEvent(
                                                new CustomEvent(
                                                    'systemMessage',
                                                    {
                                                        detail: {
                                                            text: msg,
                                                            type: 'warning',
                                                        },
                                                    },
                                                ),
                                            );
                                        } catch {
                                            /* noop */
                                        }
                                    }
                                }}
                                style={{
                                    padding: '6px 10px',
                                    background: '#e5e7eb',
                                }}
                            >
                                Resolver agora
                            </button>
                            <button
                                onClick={handleImmediateClose}
                                style={{
                                    padding: '6px 10px',
                                    background: '#e5e7eb',
                                }}
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                )}

                {pendingOpen && pendingAppt && (
                    <PendingActionsModal
                        open={pendingOpen}
                        onClose={() => {
                            setPendingOpen(false);
                            setPendingAppt(null);
                            setReloadKey(k => k + 1);
                            try {
                                refreshPendingGuard();
                            } catch {
                                /* noop */
                            }
                            try {
                                dispatchers.updateClients();
                                dispatchers.appointmentsChanged();
                            } catch {
                                /* noop */
                            }
                        }}
                        appt={pendingAppt}
                    />
                )}

                <div
                    style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        marginTop: 8,
                    }}
                >
                    <TimePicker10
                        label='Início'
                        value={startHM}
                        onChange={val => {
                            setStartHM(val);
                            const sMin = toMinutes(val);
                            let newEnd = sMin + getDefaultDuration();
                            const max =
                                workTimes.endHour * 60 + workTimes.endMin;
                            if (newEnd > max) newEnd = max;
                            setEndHM(fromMinutes(newEnd));
                        }}
                        minHour={workTimes.startHour}
                        maxHour={workTimes.endHour}
                        minHM={`${pad2(workTimes.startHour)}:${pad2(
                            workTimes.startMin,
                        )}`}
                        maxHM={`${pad2(workTimes.endHour)}:${pad2(
                            workTimes.endMin,
                        )}`}
                        stepMinutes={getSlotInterval() as 5 | 10 | 15 | 20 | 30}
                    />
                    <TimePicker10
                        label='Fim'
                        value={endHM}
                        onChange={val => setEndHM(val)}
                        minHour={workTimes.startHour}
                        maxHour={workTimes.endHour}
                        minHM={`${pad2(workTimes.startHour)}:${pad2(
                            workTimes.startMin,
                        )}`}
                        maxHM={`${pad2(workTimes.endHour)}:${pad2(
                            workTimes.endMin,
                        )}`}
                        stepMinutes={getSlotInterval() as 5 | 10 | 15 | 20 | 30}
                    />
                    <label style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>
                            Tipo
                        </span>
                        <select
                            value={visitType}
                            onChange={e =>
                                setVisitType(e.target.value as VisitType)
                            }
                            style={{ padding: '6px 8px' }}
                        >
                            <option value='consulta'>Consulta</option>
                            <option value='avaliacao'>Avaliação</option>
                            <option value='retorno'>Retorno</option>
                            <option value='procedimento'>Procedimento</option>
                            <option value='outro'>Outro</option>
                        </select>
                    </label>
                    <label
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginTop: 18,
                        }}
                    >
                        <input
                            type='checkbox'
                            checked={setDefaultVisitType}
                            onChange={e =>
                                setSetDefaultVisitType(e.target.checked)
                            }
                        />
                        <span
                            style={{
                                fontSize: 12,
                                color: 'var(--color-text-light)',
                            }}
                        >
                            Definir como padrão
                        </span>
                    </label>
                </div>

                <label style={{ display: 'flex', flexDirection: 'column' }}>
                    <span
                        style={{
                            fontSize: 12,
                            color: 'var(--color-text-light)',
                        }}
                    >
                        Observações
                    </span>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={3}
                        style={{ padding: '8px', resize: 'vertical' }}
                        placeholder='Anotações rápidas...'
                    />
                </label>

                <div
                    style={{
                        display: 'flex',
                        gap: 8,
                        justifyContent: 'flex-end',
                        position: 'sticky',
                        top: 0,
                        zIndex: 5,
                        paddingTop: 6,
                        paddingBottom: 6,
                        background: 'var(--color-bg)',
                    }}
                >
                    <button
                        onClick={handleImmediateClose}
                        style={{ padding: '8px 12px', background: '#e5e7eb' }}
                        disabled={saving}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        style={{
                            padding: '8px 12px',
                            background: '#059669',
                            color: '#fff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                        }}
                        disabled={saving}
                    >
                        {saving && (
                            <span
                                style={{
                                    width: 14,
                                    height: 14,
                                    borderRadius: '50%',
                                    border: '2px solid rgba(255,255,255,0.6)',
                                    borderTopColor: 'rgba(255,255,255,1)',
                                    animation: 'qsSpin 0.8s linear infinite',
                                }}
                            />
                        )}
                        {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar'}
                    </button>
                </div>

                <QuickScheduleDayList
                    appointments={dayAppointments}
                    loading={dayLoading}
                    dayFilter={dayFilter}
                    onChangeFilter={setDayFilter}
                    sectionDateTitle={sectionDateTitle}
                    highlightId={highlightId}
                    editingHighlightId={editingHighlightId}
                    currentEditId={currentEdit?.id ?? null}
                    listRef={listRef}
                    onUseTime={a => {
                        const sd = new Date(a.start_at);
                        const ed = new Date(a.end_at);
                        setSelectedDate(sd);
                        setStartHM(
                            `${pad2(sd.getHours())}:${pad2(sd.getMinutes())}`,
                        );
                        setEndHM(
                            `${pad2(ed.getHours())}:${pad2(ed.getMinutes())}`,
                        );
                        setCurrentEdit(null);
                    }}
                    onEdit={a => {
                        setCurrentEdit(a);
                        setEditingHighlightId(a.id);
                    }}
                    onCancel={async a => {
                        try {
                            const token = localStorage.getItem('accessToken');
                            const headers: Record<string, string> = {
                                'Content-Type': 'application/json',
                            };
                            if (token)
                                headers['Authorization'] = `Bearer ${token}`;
                            const resp = await fetch(
                                `${API_BASE}/agenda/appointments/${a.id}/cancel/`,
                                { method: 'POST', headers },
                            );
                            if (!resp.ok) {
                                const text = await resp.text();
                                throw new Error(text || 'Erro ao cancelar');
                            }
                            setReloadKey(k => k + 1);
                            try {
                                track({
                                    type: 'appointment_cancel_succeeded',
                                    payload: { id: a.id },
                                });
                            } catch {
                                /* noop */
                            }
                            try {
                                dispatchers.updateClients();
                                dispatchers.appointmentsChanged();
                            } catch {
                                /* noop */
                            }
                            setTimeout(() => {
                                try {
                                    window.dispatchEvent(
                                        new CustomEvent('scrollToClientCard', {
                                            detail: { clientId: client.id },
                                        }),
                                    );
                                } catch {
                                    /* noop */
                                }
                            }, 120);
                            if (currentEdit?.id === a.id) setCurrentEdit(null);
                            if (lastEditedId === a.id) {
                                setLastEditedId(null);
                                setHighlightId(null);
                            }
                            try {
                                handleImmediateClose();
                            } catch {
                                /* noop */
                            }
                        } catch (err) {
                            const msg =
                                err &&
                                typeof err === 'object' &&
                                'message' in err
                                    ? String((err as Error).message)
                                    : 'Erro ao cancelar';
                            setError(msg);
                            try {
                                track({
                                    type: 'appointment_cancel_failed',
                                    payload: { id: a.id, error: msg },
                                });
                            } catch {
                                /* noop */
                            }
                        }
                    }}
                />

                {error && (
                    <div style={{ color: '#b91c1c', fontSize: 14 }}>
                        {error}
                    </div>
                )}
                <style>{`@keyframes qsSpin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
                <FloatingDatePicker
                    open={showPicker}
                    onClose={() => setShowPicker(false)}
                    selectedDate={selectedDate}
                    onChange={d => {
                        setSelectedDate(d);
                        setShowPicker(false);
                    }}
                />
            </div>
        </AppModal>
    );
}
