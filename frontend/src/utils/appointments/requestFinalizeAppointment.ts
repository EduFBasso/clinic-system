import type {
    PendingReturnContext,
} from '../../types/agendaFlow';
import { openPendingActions } from './openPendingActions';

type RequestFinalizeAppointmentArgs = {
    clientId?: number;
    appointmentId?: number | null;
    isEarly: boolean;
    returnContext?: PendingReturnContext;
    proceed?: () => Promise<void> | void;
};

export function requestFinalizeAppointment({
    appointmentId,
    isEarly,
    returnContext,
    proceed,
}: RequestFinalizeAppointmentArgs) {
    const openedPending = openPendingActions({
        appointmentId,
        returnContext,
    });
    if (openedPending) return;

    if (isEarly) {
        const ok = window.confirm(
            'Finalizar a consulta antes do horário previsto?',
        );
        if (!ok) return;
    }
    void proceed?.();
}