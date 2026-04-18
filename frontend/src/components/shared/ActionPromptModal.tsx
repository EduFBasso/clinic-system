import React from 'react';
import AppModal from '../Modal';

type ActionVariant = 'neutral' | 'primary' | 'danger' | 'success';

export interface ActionPromptItem {
    label: string;
    onClick: () => void;
    variant?: ActionVariant;
}

interface ActionPromptModalProps {
    open: boolean;
    title: string;
    message: React.ReactNode;
    actions: ActionPromptItem[];
    onClose: () => void;
}

const buttonStyles: Record<ActionVariant, React.CSSProperties> = {
    neutral: {
        border: '1px solid var(--color-border)',
        background: '#fff',
        color: 'var(--color-heading)',
        fontWeight: 600,
    },
    primary: {
        border: '1px solid var(--color-primary)',
        background: 'var(--color-primary)',
        color: '#fff',
        fontWeight: 700,
    },
    danger: {
        border: '1px solid var(--color-danger)',
        background: 'var(--color-danger)',
        color: '#fff',
        fontWeight: 700,
    },
    success: {
        border: '1px solid var(--color-success-dark)',
        background: 'var(--color-success-dark)',
        color: '#fff',
        fontWeight: 700,
    },
};

export default function ActionPromptModal({
    open,
    title,
    message,
    actions,
    onClose,
}: ActionPromptModalProps) {
    if (!open) return null;

    return (
        <AppModal
            open={open}
            onClose={onClose}
            closeOnEnter={false}
            showCloseButton={false}
        >
            <div style={{ display: 'grid', gap: 12, minWidth: 280 }}>
                <h3 style={{ margin: 0, color: 'var(--color-heading)' }}>
                    {title}
                </h3>
                <div style={{ color: 'var(--color-text)' }}>{message}</div>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 8,
                        flexWrap: 'wrap',
                    }}
                >
                    {actions.map(action => {
                        const variant = action.variant ?? 'neutral';
                        return (
                            <button
                                key={action.label}
                                type='button'
                                onClick={action.onClick}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: 8,
                                    ...buttonStyles[variant],
                                }}
                            >
                                {action.label}
                            </button>
                        );
                    })}
                </div>
            </div>
        </AppModal>
    );
}