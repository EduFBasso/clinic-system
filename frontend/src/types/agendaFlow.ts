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

export interface DailyAgendaReturnContext {
    kind: 'daily-agenda';
    dateISO: string;
    focusAppointmentId?: number;
}

export interface WeeklyAgendaReturnContext {
    kind: 'weekly-agenda';
    dateISO: string;
}

export interface MonthlyAgendaReturnContext {
    kind: 'monthly-agenda';
    clientId: number;
    monthISO: string;
}

export interface DesktopAgendaReturnContext {
    kind: 'desktop-agenda';
    dateISO: string;
    focusAppointmentId?: number;
}

export interface HomeReturnContext {
    kind: 'home';
    clientId: number;
}

export type PendingReturnContext =
    | QuickScheduleReturnContext
    | DailyAgendaReturnContext
    | WeeklyAgendaReturnContext
    | MonthlyAgendaReturnContext
    | DesktopAgendaReturnContext
    | HomeReturnContext
    | null;

export interface PendingActionsOpenDetail {
    appt?: SharedAppointmentLike;
    appointmentId?: number | null;
    returnContext?: PendingReturnContext;
}

export interface ReopenAppointmentDetailsContext {
    appointmentId: number;
    returnContext?: PendingReturnContext;
}