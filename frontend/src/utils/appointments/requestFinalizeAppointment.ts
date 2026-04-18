type RequestFinalizeAppointmentArgs = {
    clientId?: number;
    appointmentId?: number | null;
    isEarly: boolean;
    proceed?: () => Promise<void> | void;
};

export function requestFinalizeAppointment({
    clientId,
    appointmentId,
    isEarly,
    proceed,
}: RequestFinalizeAppointmentArgs) {
    let prevented = false;
    try {
        const ev = new CustomEvent('confirmFinalizeAppointment', {
            detail: {
                clientId,
                appointmentId,
                isEarly,
                proceed,
            },
            cancelable: true,
        });
        prevented = !window.dispatchEvent(ev);
    } catch {
        /* noop */
    }

    if (!prevented) {
        if (isEarly) {
            const ok = window.confirm(
                'Finalizar a consulta antes do horário previsto?',
            );
            if (!ok) return;
        }
        void proceed?.();
    }
}