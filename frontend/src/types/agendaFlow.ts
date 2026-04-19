import type { SharedAppointmentLike } from '../components/shared/AppointmentCard';
import type { Appointment } from '../hooks/useAppointments';

export interface QuickScheduleInitialDraft {
    clientId: number;
    selectedDateISO: string;
    startHM: string;
    endHM: string;
    visitType: Appointment['visit_type'];
    notes: string;
}

export interface QuickScheduleReturnContext {
    kind: 'quick-schedule';
    draft: QuickScheduleInitialDraft;
}

export type PendingReturnContext = QuickScheduleReturnContext | null;

export interface PendingActionsOpenDetail {
    appt?: SharedAppointmentLike;
    appointmentId?: number | null;
    returnContext?: PendingReturnContext;
}

export interface ConfirmFinalizeAppointmentDetail {
    clientId?: number;
    appointmentId?: number | null;
    isEarly: boolean;
    returnContext?: PendingReturnContext;
    proceed?: () => Promise<void> | void;
}