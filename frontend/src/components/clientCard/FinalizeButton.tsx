import React from 'react';
import styles from './ClientCard.module.css';
import { requestFinalizeAppointment } from '../../utils/appointments/requestFinalizeAppointment';

type Props = {
    finishing: boolean;
    disabled?: boolean;
    isEarly: boolean;
    onFinalize: () => Promise<void> | void;
    clientId?: number;
    appointmentId?: number | null;
    className?: string;
};

export default function FinalizeButton({
    finishing,
    disabled,
    isEarly,
    onFinalize,
    clientId,
    appointmentId,
    className,
}: Props) {
    return (
        <button
            type='button'
            className={`${styles.actionButton} ${styles.actionPrimary} ${
                className || ''
            }`}
            title={finishing ? 'Finalizando…' : 'Finalizar atendimento'}
            disabled={!!disabled || finishing}
            onClick={e => {
                e.stopPropagation();
                requestFinalizeAppointment({
                    clientId,
                    appointmentId,
                    isEarly,
                    proceed: () => onFinalize(),
                });
            }}
            style={{ fontWeight: 700 }}
        >
            {finishing ? 'Finalizando…' : 'Finalizar'}
        </button>
    );
}
