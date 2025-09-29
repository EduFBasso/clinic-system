import React from 'react';
import {
    finalizeWithFallback,
    optionsFinalizeSupported,
} from '../services/appointments';
import { clearOngoingSnapshot } from './useOngoingSnapshot';
import { track } from '../utils/telemetry';
import { setAppointmentOverride } from '../utils/appointments/overrides';

export function useFinalizeAppointment(clientId: number) {
    const [finishing, setFinishing] = React.useState(false);

    const finalize = React.useCallback(
        async (
            appointmentId: number | null | undefined,
            opts?: {
                preferEarly?: boolean;
                openPendingAfter?: () => Promise<void> | void;
            },
        ) => {
            if (!appointmentId || finishing) return false;
            track({
                type: 'appointment_finalize_clicked',
                payload: { id: appointmentId },
            });
            setFinishing(true);
            try {
                let openPendingAfter = false;
                if (opts?.preferEarly) {
                    try {
                        const supported = await optionsFinalizeSupported(
                            appointmentId,
                        );
                        openPendingAfter = supported;
                    } catch {
                        /* noop */
                    }
                }
                const ok = await finalizeWithFallback(appointmentId);
                if (!ok) throw new Error('Não foi possível finalizar.');

                // Optimistically mark as done immediately to avoid transient 'ongoing' visuals
                try {
                    setAppointmentOverride(appointmentId, { status: 'done' });
                } catch {
                    /* noop */
                }

                try {
                    window.dispatchEvent(
                        new CustomEvent('systemMessage', {
                            detail: {
                                text: 'Atendimento finalizado',
                                type: 'success',
                            },
                        }),
                    );
                } catch {
                    /* noop */
                }

                track({
                    type: 'appointment_finalize_succeeded',
                    payload: { id: appointmentId },
                });

                try {
                    clearOngoingSnapshot(clientId);
                    window.dispatchEvent(new Event('appointments:changed'));
                    window.dispatchEvent(new Event('updateClients'));
                    // Clear ongoing latch for this client immediately in this tab
                    try {
                        window.dispatchEvent(
                            new CustomEvent('client:clearOngoing', {
                                detail: { clientId },
                            }),
                        );
                    } catch {
                        /* noop */
                    }
                    try {
                        localStorage.setItem(
                            'appointments.changed',
                            String(Date.now()),
                        );
                    } catch {
                        /* noop */
                    }
                } catch {
                    /* noop */
                }

                if (openPendingAfter && opts?.openPendingAfter) {
                    await opts.openPendingAfter();
                }
                return true;
            } catch (e) {
                const msg =
                    e && typeof e === 'object' && 'message' in e
                        ? String((e as Error).message)
                        : 'Falha ao finalizar atendimento';
                track({
                    type: 'appointment_finalize_failed',
                    payload: { id: appointmentId, error: msg },
                });
                try {
                    window.dispatchEvent(
                        new CustomEvent('systemMessage', {
                            detail: { text: msg, type: 'error' },
                        }),
                    );
                } catch {
                    /* noop */
                }
                return false;
            } finally {
                setFinishing(false);
            }
        },
        [clientId, finishing],
    );

    return { finishing, finalize } as const;
}
