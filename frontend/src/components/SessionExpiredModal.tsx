// src/components/SessionExpiredModal.tsx
import React from 'react';
import AppModal from './Modal';

interface SessionExpiredModalProps {
    open: boolean;
    onClose: () => void;
    message?: string;
    color?: string;
}

export default function SessionExpiredModal({
    open,
    onClose,
    message = 'Sua sessão expirou. Por favor, faça login novamente.',
    color = 'var(--color-error-light)', // Defina na paleta
}: SessionExpiredModalProps) {
    return (
        <AppModal open={open} onClose={onClose}>
            <div
                style={{
                    textAlign: 'center',
                    padding: '2rem',
                    background: color,
                    border: '2px solid var(--color-error-border)',
                    borderRadius: '10px',
                    color: 'var(--color-error)',
                    boxShadow: '0 2px 16px 0 rgba(211,47,47,0.12)',
                }}
            >
                <h2 style={{ color: 'var(--color-error-dark)' }}>
                    Sessão expirada
                </h2>
                <p style={{ color: 'var(--color-error)' }}>{message}</p>
                <button
                    onClick={onClose}
                    style={{
                        marginTop: '1rem',
                        padding: '0.5rem 1.5rem',
                        fontSize: '1.1rem',
                        background: 'var(--color-error)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        boxShadow: '0 1px 4px 0 rgba(211,47,47,0.18)',
                    }}
                >
                    Fechar
                </button>
            </div>
        </AppModal>
    );
}
