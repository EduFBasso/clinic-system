import React from 'react';
import styles from '../../styles/components/ClientCard.module.css';

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
            className={`${styles.actionButton} ${styles.actionPrimary} ${
                className || ''
            }`}
            title={finishing ? 'Finalizando…' : 'Finalizar atendimento'}
            disabled={!!disabled || finishing}
            onClick={e => {
                e.stopPropagation();
                let prevented = false;
                try {
                    const ev = new CustomEvent('confirmFinalizeAppointment', {
                        detail: {
                            clientId,
                            appointmentId,
                            proceed: () => onFinalize(),
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
                    void onFinalize();
                }
            }}
            style={{ fontWeight: 700 }}
        >
            {finishing ? 'Finalizando…' : 'Finalizar'}
        </button>
    );
}
