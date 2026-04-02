import React from 'react';
import type { Appointment } from './useAppointments';

interface Params {
    isOngoing: boolean;
    isPending: boolean;
    futureAppointmentsCount: number; // only futures (exclui o próximo atual)
    isScheduled: boolean;
    dynLimit: number;
    openPendingActions(): void;
    tryOpenPendingElseQuick(cb: () => void): Promise<void>;
    setEditing(appt: Appointment | null): void;
    openQuick(): void;
    baseTitle?: string; // permite variar label padrão (ex: 'Novo agendamento' vs 'Agendar')
}

export interface CreateActionResult {
    title: string;
    disabled: boolean;
    onClick(e: React.MouseEvent | React.KeyboardEvent): void;
    limitReached: boolean;
}

export function useClientCreateAction({
    isOngoing,
    isPending,
    futureAppointmentsCount,
    isScheduled,
    dynLimit,
    openPendingActions,
    tryOpenPendingElseQuick,
    setEditing,
    openQuick,
    baseTitle = 'Novo agendamento',
}: Params): CreateActionResult {
    const totalScheduled = (isScheduled ? 1 : 0) + futureAppointmentsCount;
    const limitReached = totalScheduled >= dynLimit;

    const title = isPending
        ? 'Resolver pendência deste cliente'
        : isOngoing
        ? 'Em andamento: finalize para criar um novo.'
        : limitReached
        ? `Limite de ${dynLimit} compromissos (atual: ${totalScheduled})`
        : baseTitle;

    const disabled = isOngoing || limitReached;

    const onClick = React.useCallback(
        (e: React.MouseEvent | React.KeyboardEvent) => {
            e.stopPropagation();
            if (isOngoing) {
                try {
                    window.dispatchEvent(
                        new CustomEvent('systemMessage', {
                            detail: {
                                text: 'Finalize o atendimento em andamento antes de criar outro.',
                                type: 'warning',
                            },
                        }),
                    );
                } catch {
                    /* noop */
                }
                return;
            }
            if (isPending) {
                openPendingActions();
                return;
            }
            if (limitReached) {
                try {
                    window.dispatchEvent(
                        new CustomEvent('systemMessage', {
                            detail: {
                                text: `Limite de ${dynLimit} compromissos atingido (total: ${totalScheduled})`,
                                type: 'warning',
                            },
                        }),
                    );
                } catch {
                    /* noop */
                }
                return;
            }
            (async () => {
                await tryOpenPendingElseQuick(() => {
                    setEditing(null);
                    openQuick();
                });
            })();
        },
        [
            isOngoing,
            isPending,
            limitReached,
            dynLimit,
            totalScheduled,
            openPendingActions,
            tryOpenPendingElseQuick,
            setEditing,
            openQuick,
        ],
    );

    return { title, disabled, onClick, limitReached };
}
