import React from 'react';
import formStyles from '../../styles/pages/Client.module.css';

interface Props {
    title: string;
    style?: React.CSSProperties;
    children: React.ReactNode;
    onClose?: () => void; // opcional: exibe botão X no canto superior direito
    closeTitle?: string; // tooltip do botão X
}

export default function FormSection({
    title,
    style,
    children,
    onClose,
    closeTitle,
}: Props) {
    return (
        <section style={{ position: 'relative', ...style }}>
            <h3 className={formStyles.panelTitle}>{title}</h3>
            {onClose && (
                <button
                    type='button'
                    aria-label='Fechar'
                    title={closeTitle || 'Fechar'}
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: 10,
                        right: 12,
                        background: 'rgba(255,255,255,0.95)',
                        border: '1px solid var(--color-border)',
                        cursor: 'pointer',
                        fontSize: 18,
                        color: 'var(--color-text)',
                        borderRadius: 8,
                        padding: '6px 10px',
                        lineHeight: 1,
                        zIndex: 5,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                    }}
                >
                    ✖
                </button>
            )}
            <div
                style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
            >
                <div
                    className={formStyles.formPanels}
                    style={{
                        flexDirection: 'column',
                        gap: '0.75rem',
                        minWidth: 0,
                    }}
                >
                    {children}
                </div>
            </div>
        </section>
    );
}
