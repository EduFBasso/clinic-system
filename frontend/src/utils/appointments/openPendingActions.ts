import type {
    PendingActionsOpenDetail,
    PendingReturnContext,
} from '../../types/agendaFlow';

type AppointmentRef = { id: number } | number;

export function openPendingActions(params: {
    appointmentId: number | null | undefined;
    returnContext?: PendingReturnContext;
}) {
    const { appointmentId, returnContext } = params;
    if (!appointmentId) return false;
    try {
        window.dispatchEvent(
            new CustomEvent<PendingActionsOpenDetail>('pendingActions:open', {
                detail: {
                    appointmentId,
                    returnContext,
                },
            }),
        );
        return true;
    } catch {
        return false;
    }
}

export function openPendingActionsForAppointment(
    appointment: AppointmentRef | null | undefined,
    returnContext?: PendingReturnContext,
) {
    const appointmentId =
        typeof appointment === 'number' ? appointment : appointment?.id;
    return openPendingActions({ appointmentId, returnContext });
}