import type {
    PendingActionsOpenDetail,
    PendingReturnContext,
} from '../../types/agendaFlow';
import { emit } from '../../events/bus';

type AppointmentRef = { id: number } | number;

export function openPendingActions(params: {
    appointmentId: number | null | undefined;
    returnContext?: PendingReturnContext;
}) {
    const { appointmentId, returnContext } = params;
    if (!appointmentId) return false;
    try {
        emit('pendingActions:open', {
            appointmentId,
            returnContext,
        } satisfies PendingActionsOpenDetail);
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