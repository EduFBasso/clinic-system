import React from 'react';
import { API_BASE } from '../config/api';
import { ensureClientBasic } from './useAgendaModals';
import type {
    PendingReturnContext,
    QuickScheduleInitialDraft,
    ReopenAppointmentDetailsContext,
} from '../types/agendaFlow';
import type { Appointment } from './useAppointments';
import type { ClientBasic } from '../types/ClientBasic';
import { getAccessToken } from '../utils/auth/session';

type SysMsg = {
    text: string;
    type: 'success' | 'error' | 'info' | 'warning';
    autoCloseMs?: number;
};

const LOGIN_REQUIRED_MSG_KEY = 'loginRequiredMsg';
const RESUME_QUICK_SCHEDULE_KEY = 'resumeQuickSchedule';
const RESUME_AGENDA_MODAL_KEY = 'resumeAgendaModal';
const RESUME_HOME_FOCUS_KEY = 'resumeHomeFocus';
const REOPEN_APPOINTMENT_DETAILS_KEY = 'reopenAppointmentDetails';

function consumeString(key: string) {
    const value = sessionStorage.getItem(key);
    if (!value) return null;
    sessionStorage.removeItem(key);
    return value;
}

export function useHomeResumeFlows(params: {
    locationKey: string;
    openDaily: (date: Date, focusId?: number) => void;
    openWeekly: (date?: Date) => void;
    setRouteClient: React.Dispatch<React.SetStateAction<ClientBasic | undefined>>;
    setRouteInitialMonth: React.Dispatch<React.SetStateAction<Date | undefined>>;
    setMonthlyOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setRouteEditAppt: React.Dispatch<React.SetStateAction<Appointment | null>>;
    setQuickInitialDraft: React.Dispatch<React.SetStateAction<QuickScheduleInitialDraft | null>>;
    setQuickOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setDetailsAppt: React.Dispatch<React.SetStateAction<Appointment | null>>;
    setDetailsOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setDetailsReturnContext: React.Dispatch<
        React.SetStateAction<PendingReturnContext>
    >;
    setSysMsg: React.Dispatch<React.SetStateAction<SysMsg | null>>;
}) {
    const {
        locationKey,
        openDaily,
        openWeekly,
        setRouteClient,
        setRouteInitialMonth,
        setMonthlyOpen,
        setRouteEditAppt,
        setQuickInitialDraft,
        setQuickOpen,
        setDetailsAppt,
        setDetailsOpen,
        setDetailsReturnContext,
        setSysMsg,
    } = params;

    React.useEffect(() => {
        const loginMsg = consumeString(LOGIN_REQUIRED_MSG_KEY);
        if (!loginMsg) return;
        setSysMsg({ text: loginMsg, type: 'error', autoCloseMs: 8000 });
    }, [locationKey, setSysMsg]);

    React.useEffect(() => {
        const resumeQuickRaw = consumeString(RESUME_QUICK_SCHEDULE_KEY);
        if (resumeQuickRaw) {
            try {
                const parsed = JSON.parse(
                    resumeQuickRaw,
                ) as QuickScheduleInitialDraft;
                if (parsed?.clientId) {
                    void ensureClientBasic(parsed.clientId)
                        .then(clientBasic => {
                            setRouteClient(clientBasic);
                            setRouteEditAppt(null);
                            setQuickInitialDraft(parsed);
                            setQuickOpen(true);
                        })
                        .catch(() => {
                            /* noop */
                        });
                }
            } catch {
                /* noop */
            }
            return;
        }

        const resumeHomeRaw = consumeString(RESUME_HOME_FOCUS_KEY);
        if (resumeHomeRaw) {
            // Scroll position is restored by MainContent's own scroll restoration.
            // Just consume the key without auto-scrolling — the list stays at its last position.
            return;
        }

        const resumeAgendaRaw = consumeString(RESUME_AGENDA_MODAL_KEY);
        if (resumeAgendaRaw) {
            try {
                const parsed = JSON.parse(
                    resumeAgendaRaw,
                ) as PendingReturnContext;
                if (parsed?.kind === 'daily-agenda') {
                    const date = new Date(`${parsed.dateISO}T00:00:00`);
                    if (!Number.isNaN(date.getTime())) {
                        openDaily(date, parsed.focusAppointmentId);
                    }
                    return;
                }
                if (parsed?.kind === 'weekly-agenda') {
                    const date = new Date(`${parsed.dateISO}T00:00:00`);
                    openWeekly(Number.isNaN(date.getTime()) ? undefined : date);
                    return;
                }
                if (parsed?.kind === 'monthly-agenda' && parsed.clientId) {
                    const date = new Date(`${parsed.monthISO}T00:00:00`);
                    void ensureClientBasic(parsed.clientId)
                        .then(clientBasic => {
                            setRouteClient(clientBasic);
                            setRouteInitialMonth(
                                Number.isNaN(date.getTime())
                                    ? undefined
                                    : date,
                            );
                            setMonthlyOpen(true);
                        })
                        .catch(() => {
                            /* noop */
                        });
                }
            } catch {
                /* noop */
            }
        }
    }, [
        locationKey,
        openDaily,
        openWeekly,
        setMonthlyOpen,
        setQuickInitialDraft,
        setQuickOpen,
        setRouteClient,
        setRouteEditAppt,
        setRouteInitialMonth,
    ]);

    React.useEffect(() => {
        const raw = consumeString(REOPEN_APPOINTMENT_DETAILS_KEY);
        if (!raw) return;

        let payload: ReopenAppointmentDetailsContext | null = null;
        try {
            payload = JSON.parse(raw) as ReopenAppointmentDetailsContext;
        } catch {
            const apptId = parseInt(raw, 10);
            if (apptId) payload = { appointmentId: apptId };
        }
        if (!payload?.appointmentId) return;

        const token = getAccessToken();
        if (!token) return;

        fetch(`${API_BASE}/agenda/appointments/${payload.appointmentId}/`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => (r.ok ? r.json() : null))
            .then(appt => {
                if (appt) {
                    setDetailsReturnContext(payload?.returnContext ?? null);
                    setDetailsAppt(appt as Appointment);
                    setDetailsOpen(true);
                }
            })
            .catch(() => {
                /* noop */
            });
    }, [
        locationKey,
        setDetailsAppt,
        setDetailsOpen,
        setDetailsReturnContext,
    ]);
}