import React from 'react';
import { useFinalizeAppointment } from './useFinalizeAppointment';
import { isClientLike } from '../utils/appointments/agendaHelpers';

type AppointmentLike = {
    id: number;
    client?: { id: number; name?: string } | number | null;
};

function getClientId(appt: AppointmentLike): number | undefined {
    const raw = appt.client;
    if (typeof raw === 'number') return raw;
    if (isClientLike(raw)) return raw.id;
    return undefined;
}

export function useAgendaFinalizeAction(onSuccess?: () => void) {
    const { finishing, finalize } = useFinalizeAppointment();

    const handleFinalize = React.useCallback(
        async (appt: AppointmentLike) => {
            const clientId = getClientId(appt);
            const ok = await finalize(appt.id, {
                clientId,
                preferEarly: true,
            });
            if (ok) onSuccess?.();
        },
        [finalize, onSuccess],
    );

    return { finishing, handleFinalize } as const;
}