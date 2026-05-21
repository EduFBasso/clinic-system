import React from 'react';
import styles from './ClientCard.module.css';

type Props = {
    disabled?: boolean;
    solving?: boolean;
    onSolve: () => void | Promise<void>;
    className?: string;
};

// Botão para acionar fluxo de resolução de pendências (abrir modal de ações)
export default function SolveButton({
    disabled,
    solving,
    onSolve,
    className,
}: Props) {
    return (
        <button
            type='button'
            className={`${styles.actionButton} ${styles.actionPending} ${
                className || ''
            }`}
            title={solving ? 'Abrindo…' : 'Resolver pendência'}
            disabled={!!disabled || solving}
            onClick={e => {
                e.stopPropagation();
                void onSolve();
            }}
            style={{ fontWeight: 700 }}
        >
            {solving ? 'Abrindo…' : 'Solucionar'}
        </button>
    );
}
