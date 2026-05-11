import React from 'react';
import type { SharedAppointmentLike } from '../components/shared/AppointmentCard';
import { getAppointmentOverride } from '../utils/appointments/overrides';
import { API_BASE } from '../config/api';
import type {
    PendingActionsOpenDetail,
    PendingReturnContext,
} from '../types/agendaFlow';
import { on } from '../events/bus';
import { getAccessToken } from '../utils/auth/session';

export interface UsePendingActionsListenersReturn {
    pendingActionsOpen: boolean;
    pendingAppt: SharedAppointmentLike | null;
    pendingReturnContext: PendingReturnContext;
    closePendingActions: () => void;
}

export function usePendingActionsListeners(): UsePendingActionsListenersReturn {
    const [pendingActionsOpen, setPendingActionsOpen] = React.useState(false);
    const [pendingAppt, setPendingAppt] =
        React.useState<SharedAppointmentLike | null>(null);
    const [pendingReturnContext, setPendingReturnContext] =
        React.useState<PendingReturnContext>(null);
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

    // Listener: pendingActions:open → open PendingActionsModal (with cancel suppression)
    React.useEffect(() => {
        const recentCanceled = new Map<number, number>(); // apptId → timestamp

        function onCancelFinalizeFlag(det: { id?: number; status?: string }) {
            if (det?.id && det.status === 'canceled') {
                recentCanceled.set(det.id, Date.now());
            }
        }

        async function onOpenPending(det: PendingActionsOpenDetail) {
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
                setPendingReturnContext(det.returnContext ?? null);
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
                const token = getAccessToken();
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
                if (
                    data.status &&
                    data.status !== 'scheduled' &&
                    data.status !== 'pending'
                ) {
                    try {
                        window.dispatchEvent(
                            new CustomEvent('debug:log', {
                                detail: {
                                    label: 'Home: skipped open (status not pending/scheduled)',
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

        const disposeStatusChanged = on(
            'appointment:statusChanged',
            onCancelFinalizeFlag,
        );
        const disposePendingOpen = on('pendingActions:open', onOpenPending);
        return () => {
            disposePendingOpen();
            disposeStatusChanged();
        };
    }, []);

    // Failsafe: forceClose event syncs local state
    React.useEffect(() => {
        const onForceClose = () => {
            setPendingActionsOpen(false);
            setPendingReturnContext(null);
            lastPendingCloseRef.current = Date.now();
        };
        return on('pendingActions:forceClose', onForceClose);
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
