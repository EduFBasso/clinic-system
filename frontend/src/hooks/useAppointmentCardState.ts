import React from 'react';
import { deriveStatus } from '../utils/appointments/status';

export interface AppointmentCardState {
    status: 'scheduled' | 'done' | 'canceled' | 'ongoing' | 'past';
    isOngoing: boolean;
    canEdit: boolean;
    canCancel: boolean;
    start: Date;
    end: Date;
}

export function useAppointmentCardState(
    appt: {
        start_at: string;
        end_at: string;
        status: 'scheduled' | 'pending' | 'done' | 'canceled' | 'ongoing';
    },
    now: Date,
): AppointmentCardState {
    const start = React.useMemo(() => new Date(appt.start_at), [appt.start_at]);
    const end = React.useMemo(() => new Date(appt.end_at), [appt.end_at]);
    // Visual status derived from timing + server status
    const status = React.useMemo(() => deriveStatus(appt, now), [appt, now]);
    const isOngoing = status === 'ongoing';
    // Edição permanece restrita a agendados futuros (antes do início)
    const canEdit = status === 'scheduled' && end > now;
    // Cancelamento é permitido tanto antes do início quanto durante um atendimento em andamento.
    const canCancel =
        (status === 'scheduled' || status === 'ongoing') && end > now;
    return { status, isOngoing, canEdit, canCancel, start, end };
}
