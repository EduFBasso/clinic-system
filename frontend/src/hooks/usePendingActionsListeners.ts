import React from 'react';
import type { SharedAppointmentLike } from '../components/shared/AppointmentCard';
import { getAppointmentOverride } from '../utils/appointments/overrides';
import { API_BASE } from '../config/api';

export interface UsePendingActionsListenersReturn {
    pendingActionsOpen: boolean;
    pendingAppt: SharedAppointmentLike | null;
    pendingReturnContext: unknown;
    closePendingActions: () => void;
}

export function usePendingActionsListeners(): UsePendingActionsListenersReturn {
    const [pendingActionsOpen, setPendingActionsOpen] = React.useState(false);
    const [pendingAppt, setPendingAppt] =
        React.useState<SharedAppointmentLike | null>(null);
    const [pendingReturnContext, setPendingReturnContext] =
        React.useState<unknown>(null);
    const lastPendingCloseRef = React.useRef<number>(0);

    const closePendingActions = React.useCallback(() => {
        setPendingActionsOpen(false);
        setPendingReturnContext(null);
    }, []);

    // After close: clear pending appt object a bit later to avoid stale prop refs
    React.useEffect(() => {
        if (pendingActionsOpen) return;
        const t = setTimeout(() => {
            setPendingAppt(pa => (pendingActionsOpen ? pa : null));
            setPendingReturnContext(ctx => (pendingActionsOpen ? ctx : null));
        }, 80);
        return () => clearTimeout(t);
    }, [pendingActionsOpen]);

    // Listener: confirmFinalizeAppointment → open PendingActionsModal
    React.useEffect(() => {
        async function onConfirmFinalize(e: Event) {
            const ce = e as CustomEvent;
            const det =
                (ce && (ce as CustomEvent).detail) ||
                ({} as {
                    isEarly?: boolean;
                    clientId?: number;
                    appointmentId?: number | null;
                    returnContext?: unknown;
                    proceed?: () => void;
                });
            try {
                (e as Event).preventDefault?.();
            } catch {
                /* noop */
            }

            const apptId = det.appointmentId;
            if (!apptId) {
                try {
                    window.dispatchEvent(
                        new CustomEvent('systemMessage', {
                            detail: {
                                text: 'Não foi possível identificar o agendamento para concluir.',
                                type: 'error',
                            },
                        }),
                    );
                } catch {
                    /* noop */
                }
                return;
            }

            const nowTs = Date.now();
            if (nowTs - lastPendingCloseRef.current < 1500) {
                try {
                    window.dispatchEvent(
                        new CustomEvent('debug:log', {
                            detail: {
                                label: 'Home: suppressed confirmFinalize due to recent forceClose',
                                data: {
                                    deltaMs:
                                        nowTs - lastPendingCloseRef.current,
                                },
                                ts: nowTs,
                            },
                        }),
                    );
                } catch {
                    /* noop */
                }
                return;
            }

            try {
                const token = localStorage.getItem('accessToken') || '';
                const headers: Record<string, string> = {};
                if (token) headers['Authorization'] = `Bearer ${token}`;
                const r = await fetch(
                    `${API_BASE}/agenda/appointments/${apptId}/`,
                    {
                        headers,
                        cache: 'no-store',
                    },
                );
                if (!r.ok) throw new Error('Falha ao carregar agendamento');
                const data = await r.json();
                const appt: SharedAppointmentLike = {
                    id: data.id,
                    start_at: data.start_at,
                    end_at: data.end_at,
                    status: data.status,
                    notes: data.notes,
                    client_name: data.client_name,
                    client: data.client,
                    title: data.title,
                };
                setPendingAppt(appt);
                setPendingReturnContext(det.returnContext ?? null);
                setPendingActionsOpen(true);
            } catch (err) {
                const msg =
                    err instanceof Error
                        ? err.message
                        : 'Erro ao abrir ações pendentes';
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
        }
        window.addEventListener(
            'confirmFinalizeAppointment',
            onConfirmFinalize as EventListener,
        );
        return () =>
            window.removeEventListener(
                'confirmFinalizeAppointment',
                onConfirmFinalize as EventListener,
            );
    }, []);

    // Listener: pendingActions:open → open PendingActionsModal (with cancel suppression)
    React.useEffect(() => {
        const recentCanceled = new Map<number, number>(); // apptId → timestamp

        function onCancelFinalizeFlag(ev: Event) {
            const ce = ev as CustomEvent;
            const det = (ce?.detail || {}) as { id?: number; status?: string };
            if (det?.id && det.status === 'canceled') {
                recentCanceled.set(det.id, Date.now());
            }
        }
        window.addEventListener(
            'appointment:statusChanged',
            onCancelFinalizeFlag,
        );

        async function onOpenPending(e: Event) {
            const ce = e as CustomEvent;
            const det =
                (ce && (ce as CustomEvent).detail) ||
                ({} as {
                    appt?: SharedAppointmentLike;
                    appointmentId?: number | null;
                });

            try {
                const stack = new Error().stack;
                window.dispatchEvent(
                    new CustomEvent('debug:log', {
                        detail: {
                            label: 'Home: pendingActions:open received',
                            data: {
                                hasApptInDetail: !!det.appt,
                                appointmentId:
                                    det.appt?.id ?? det.appointmentId,
                                triggeredAt: new Date().toISOString(),
                                stack,
                            },
                            ts: Date.now(),
                        },
                    }),
                );
            } catch {
                /* noop */
            }
            try {
                (e as Event).preventDefault?.();
            } catch {
                /* noop */
            }

            const nowTs = Date.now();
            if (nowTs - lastPendingCloseRef.current < 1500) {
                try {
                    window.dispatchEvent(
                        new CustomEvent('debug:log', {
                            detail: {
                                label: 'Home: suppressed pendingActions:open due to recent forceClose',
                                data: {
                                    deltaMs:
                                        nowTs - lastPendingCloseRef.current,
                                },
                                ts: nowTs,
                            },
                        }),
                    );
                } catch {
                    /* noop */
                }
                return;
            }

            if (det.appt) {
                setPendingReturnContext(null);
                const rcTs = det.appt.id
                    ? recentCanceled.get(det.appt.id)
                    : undefined;
                if (rcTs && Date.now() - rcTs < 8000) {
                    try {
                        window.dispatchEvent(
                            new CustomEvent('debug:log', {
                                detail: {
                                    label: 'Home: suppressed reopen (recent canceled appt object)',
                                    data: {
                                        apptId: det.appt.id,
                                        deltaMs: Date.now() - rcTs,
                                    },
                                    ts: Date.now(),
                                },
                            }),
                        );
                    } catch {
                        /* noop */
                    }
                    return;
                }
                setPendingAppt(det.appt);
                setPendingActionsOpen(true);
                return;
            }

            const apptId = det.appointmentId;
            if (!apptId) return;
            const rcTs = recentCanceled.get(apptId);
            if (rcTs && Date.now() - rcTs < 8000) {
                try {
                    window.dispatchEvent(
                        new CustomEvent('debug:log', {
                            detail: {
                                label: 'Home: suppressed reopen (recent canceled apptId)',
                                data: { apptId, deltaMs: Date.now() - rcTs },
                                ts: Date.now(),
                            },
                        }),
                    );
                } catch {
                    /* noop */
                }
                return;
            }

            try {
                const token = localStorage.getItem('accessToken') || '';
                const headers: Record<string, string> = {};
                if (token) headers['Authorization'] = `Bearer ${token}`;
                const r = await fetch(
                    `${API_BASE}/agenda/appointments/${apptId}/`,
                    {
                        headers,
                        cache: 'no-store',
                    },
                );
                if (!r.ok) throw new Error('Falha ao carregar agendamento');
                const data = await r.json();
                if (data.status && data.status !== 'scheduled') {
                    try {
                        window.dispatchEvent(
                            new CustomEvent('debug:log', {
                                detail: {
                                    label: 'Home: skipped open (status not scheduled)',
                                    data: { apptId, status: data.status },
                                    ts: Date.now(),
                                },
                            }),
                        );
                    } catch {
                        /* noop */
                    }
                    return;
                }
                const appt: SharedAppointmentLike = {
                    id: data.id,
                    start_at: data.start_at,
                    end_at: data.end_at,
                    status: data.status,
                    notes: data.notes,
                    client_name: data.client_name,
                    client: data.client,
                    title: data.title,
                };
                setPendingAppt(appt);
                setPendingReturnContext(null);
                setPendingActionsOpen(true);
            } catch (err) {
                const msg =
                    err instanceof Error
                        ? err.message
                        : 'Erro ao abrir ações pendentes';
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
        }

        window.addEventListener(
            'pendingActions:open',
            onOpenPending as EventListener,
        );
        return () => {
            window.removeEventListener(
                'pendingActions:open',
                onOpenPending as EventListener,
            );
            window.removeEventListener(
                'appointment:statusChanged',
                onCancelFinalizeFlag as EventListener,
            );
        };
    }, []);

    // Failsafe: forceClose event syncs local state
    React.useEffect(() => {
        const onForceClose = () => {
            setPendingActionsOpen(false);
            setPendingReturnContext(null);
            lastPendingCloseRef.current = Date.now();
        };
        window.addEventListener('pendingActions:forceClose', onForceClose);
        return () =>
            window.removeEventListener(
                'pendingActions:forceClose',
                onForceClose,
            );
    }, []);

    // Auto-close when override shows terminal status for the open appointment
    React.useEffect(() => {
        if (!pendingActionsOpen || !pendingAppt) return;
        try {
            const ov = getAppointmentOverride(pendingAppt.id as number);
            if (ov && (ov.status === 'done' || ov.status === 'canceled')) {
                setPendingActionsOpen(false);
            }
        } catch {
            /* noop */
        }
    }, [pendingActionsOpen, pendingAppt]);

    // Debug instrumentation: expose helpers to window
    React.useEffect(() => {
        const w = window as unknown as Record<string, unknown>;
        w.__closePendingActions = () => {
            try {
                setPendingActionsOpen(false);
                console.debug('[PendingDebug] __closePendingActions called');
            } catch (e) {
                console.warn('[PendingDebug] close error', e);
            }
        };
        w.__dumpPendingActions = () => {
            try {
                const id = pendingAppt?.id;
                const ov = id ? getAppointmentOverride(id) : undefined;
                console.debug('[PendingDebug] dump', {
                    pendingActionsOpen,
                    apptId: id,
                    apptStatus: pendingAppt?.status,
                    override: ov,
                });
                return {
                    pendingActionsOpen,
                    id,
                    status: pendingAppt?.status,
                    override: ov,
                };
            } catch (e) {
                console.warn('[PendingDebug] dump error', e);
                return null;
            }
        };
        const onDebugDump = () => {
            (w.__dumpPendingActions as () => unknown)();
        };
        window.addEventListener('pendingActions:debugDump', onDebugDump);
        return () => {
            try {
                delete w.__closePendingActions;
                delete w.__dumpPendingActions;
            } catch {
                /* noop */
            }
            window.removeEventListener('pendingActions:debugDump', onDebugDump);
        };
    }, [pendingActionsOpen, pendingAppt]);

    return {
        pendingActionsOpen,
        pendingAppt,
        pendingReturnContext,
        closePendingActions,
    };
}
