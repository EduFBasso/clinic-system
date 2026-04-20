import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { PendingReturnContext } from '../types/agendaFlow';

const CONSULTA_PAGE_CONTEXT_KEY = 'consultaPageContext';
const RESUME_QUICK_SCHEDULE_KEY = 'resumeQuickSchedule';
const RESUME_AGENDA_MODAL_KEY = 'resumeAgendaModal';
const REOPEN_APPOINTMENT_DETAILS_KEY = 'reopenAppointmentDetails';

export interface ConsultaPageState<TItem = unknown> {
    appointmentId?: number;
    clientName?: string;
    clientId?: number;
    startAt?: string;
    endAt?: string;
    chargeId?: number;
    chargeItems?: TItem[];
    chargeNotes?: string;
    returnContext?: PendingReturnContext;
}

function loadConsultaPageState<TItem>(
    locationState: unknown,
): ConsultaPageState<TItem> {
    const fromRouter = (locationState ?? {}) as ConsultaPageState<TItem>;
    if (fromRouter.appointmentId) return fromRouter;

    try {
        const saved = sessionStorage.getItem(CONSULTA_PAGE_CONTEXT_KEY);
        if (saved) {
            const parsed = JSON.parse(saved) as ConsultaPageState<TItem>;
            if (parsed.appointmentId) {
                sessionStorage.removeItem(CONSULTA_PAGE_CONTEXT_KEY);
                return parsed;
            }
        }
    } catch {
        /* noop */
    }

    return fromRouter;
}

function persistConsultaPageState<TItem>(state: ConsultaPageState<TItem>) {
    try {
        sessionStorage.setItem(CONSULTA_PAGE_CONTEXT_KEY, JSON.stringify(state));
    } catch {
        /* noop */
    }
}

function persistResumeQuickSchedule(returnContext?: PendingReturnContext) {
    if (returnContext?.kind !== 'quick-schedule') return false;

    try {
        sessionStorage.setItem(
            RESUME_QUICK_SCHEDULE_KEY,
            JSON.stringify(returnContext.draft ?? null),
        );
    } catch {
        /* noop */
    }

    return true;
}

function persistResumeAgendaModal(returnContext?: PendingReturnContext) {
    if (
        returnContext?.kind !== 'daily-agenda' &&
        returnContext?.kind !== 'weekly-agenda' &&
        returnContext?.kind !== 'monthly-agenda'
    ) {
        return false;
    }

    try {
        sessionStorage.setItem(
            RESUME_AGENDA_MODAL_KEY,
            JSON.stringify(returnContext),
        );
    } catch {
        /* noop */
    }

    return true;
}

function persistReopenAppointmentDetails(appointmentId?: number) {
    if (!appointmentId) return;

    try {
        sessionStorage.setItem(
            REOPEN_APPOINTMENT_DETAILS_KEY,
            String(appointmentId),
        );
    } catch {
        /* noop */
    }
}

export function useConsultaPageContext<TItem>(params: {
    selectedItems: TItem[];
    notes: string;
}) {
    const navigate = useNavigate();
    const location = useLocation();
    const { selectedItems, notes } = params;

    const [apptState] = React.useState<ConsultaPageState<TItem>>(() =>
        loadConsultaPageState<TItem>(location.state),
    );

    const saveAndNavigateToCatalog = React.useCallback(
        (path: string) => {
            persistConsultaPageState({
                appointmentId: apptState.appointmentId,
                clientId: apptState.clientId,
                clientName: apptState.clientName,
                startAt: apptState.startAt,
                endAt: apptState.endAt,
                chargeId: apptState.chargeId,
                chargeItems: selectedItems,
                chargeNotes: notes,
                returnContext: apptState.returnContext,
            });
            navigate(path, { state: { returnTo: '/consulta' } });
        },
        [
            apptState.appointmentId,
            apptState.chargeId,
            apptState.clientId,
            apptState.clientName,
            apptState.endAt,
            apptState.returnContext,
            apptState.startAt,
            navigate,
            notes,
            selectedItems,
        ],
    );

    const handleSuccessfulRegister = React.useCallback(() => {
        if (persistResumeQuickSchedule(apptState.returnContext)) {
            navigate('/');
            return;
        }

        if (persistResumeAgendaModal(apptState.returnContext)) {
            navigate('/');
            return;
        }

        persistReopenAppointmentDetails(apptState.appointmentId);
        navigate(-1);
    }, [apptState.appointmentId, apptState.returnContext, navigate]);

    return {
        apptState,
        saveAndNavigateToCatalog,
        handleSuccessfulRegister,
    };
}