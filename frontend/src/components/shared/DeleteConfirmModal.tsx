import React from 'react';

interface DeleteConfirmModalProps {
    title: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function DeleteConfirmModal({
    title,
    onConfirm,
    onCancel,
}: DeleteConfirmModalProps) {
    return (
        <div
            role='dialog'
            aria-modal='true'
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '1rem',
            }}
        >
            <div
                style={{
                    background: '#fff',
                    borderRadius: 8,
                    padding: '1.25rem 1.5rem',
                    maxWidth: 480,
                    width: '100%',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                    fontSize: '1rem',
                }}
            >
                <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.15rem' }}>
                    {title}
                </h2>
                <p style={{ margin: '0 0 0.75rem', lineHeight: 1.45 }}>
                    Esta exclusão é definitiva e também removerá:
                </p>
                <ul style={{ margin: '0 0 1rem 1.2rem', lineHeight: 1.5 }}>
                    <li>agendamentos e compromissos antigos e futuros</li>
                    <li>dados financeiros e cobranças deste cliente</li>
                    <li>anamnese, prontuário e histórico relacionado</li>
                </ul>
                <p style={{ margin: '0 0 1.25rem', lineHeight: 1.45 }}>
                    Após excluir, esses dados não poderão ser recuperados.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button
                        type='button'
                        onClick={onCancel}
                        style={{
                            background: '#e5e7eb',
                            color: '#111827',
                            border: 'none',
                            borderRadius: 6,
                            padding: '0.6rem 1.1rem',
                            cursor: 'pointer',
                            fontWeight: 600,
                        }}
                    >
                        Cancelar
                    </button>
                    <button
                        type='button'
                        onClick={onConfirm}
                        style={{
                            background: '#dc2626',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            padding: '0.6rem 1.1rem',
                            cursor: 'pointer',
                            fontWeight: 600,
                        }}
                    >
                        Excluir
                    </button>
                </div>
            </div>
        </div>
    );
}
