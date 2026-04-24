import React from 'react';
import { optionsFinalizeSupported } from '../services/appointments';
import { finalizeFlow } from '../services/flows/finalizeFlow';
import { dispatchers } from '../events/dispatchers';
import { clearOngoingSnapshot } from './useOngoingSnapshot';
import { track } from '../utils/telemetry';
import { setAppointmentOverride } from '../utils/appointments/overrides';

export function useFinalizeAppointment(defaultClientId?: number) {
    const [finishing, setFinishing] = React.useState(false);

    const finalize = React.useCallback(
        async (
            appointmentId: number | null | undefined,
            opts?: {
                clientId?: number;
                preferEarly?: boolean;
                openPendingAfter?: () => Promise<void> | void;
            },
        ) => {
            if (!appointmentId || finishing) return false;
            const clientId = opts?.clientId ?? defaultClientId;
            if (!clientId) {
                try {
                    window.dispatchEvent(
                        new CustomEvent('systemMessage', {
                            detail: {
                                text: 'Não foi possível identificar o cliente para finalizar o atendimento.',
                                type: 'error',
                            },
                        }),
                    );
                } catch {
                    /* noop */
                }
                return false;
            }
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
                const res = await finalizeFlow(appointmentId);
                const ok = res.ok;
                if (!ok) throw new Error('Não foi possível finalizar.');

                // Keep the card out of the ongoing state while the consulta flow resolves it.
                try {
                    setAppointmentOverride(appointmentId, {
                        status: 'pending',
                    });
                } catch {
                    /* noop */
                }

                // Só mostra mensagem de finalização se não for abrir o fluxo de pendências em seguida
                try {
                    if (!openPendingAfter) {
                        window.dispatchEvent(
                            new CustomEvent('systemMessage', {
                                detail: {
                                    text: 'Atendimento enviado para pendência.',
                                    type: 'success',
                                },
                            }),
                        );
                    }
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
                    dispatchers.updateClients();
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
        [defaultClientId, finishing],
    );

    return { finishing, finalize } as const;
}
