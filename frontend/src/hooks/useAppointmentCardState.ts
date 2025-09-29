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
        status: 'scheduled' | 'done' | 'canceled' | 'ongoing';
    },
    now: Date,
): AppointmentCardState {
    const start = React.useMemo(() => new Date(appt.start_at), [appt.start_at]);
    const end = React.useMemo(() => new Date(appt.end_at), [appt.end_at]);
    const status = React.useMemo(() => deriveStatus(appt, now), [appt, now]);
    const isOngoing = status === 'ongoing';
    const canEdit = status === 'scheduled' && end > now;
    const canCancel = status === 'scheduled' && end > now;
    return { status, isOngoing, canEdit, canCancel, start, end };
}
