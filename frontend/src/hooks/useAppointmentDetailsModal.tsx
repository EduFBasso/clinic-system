import React from 'react';
import AppointmentDetailsModal from '../components/AppointmentDetailsModal';
import type { Appointment } from './useAppointments';

export function useAppointmentDetailsModal<T extends Appointment>() {
    const [detailsAppt, setDetailsAppt] = React.useState<T | null>(null);

    const openDetails = React.useCallback((appt: T) => {
        setDetailsAppt(appt);
    }, []);

    const closeDetails = React.useCallback(() => {
        setDetailsAppt(null);
    }, []);

    const detailsModal = detailsAppt ? (
        <AppointmentDetailsModal
            open
            onClose={closeDetails}
            appt={detailsAppt}
        />
    ) : null;

    return {
        openDetails,
        detailsModal,
    };
}