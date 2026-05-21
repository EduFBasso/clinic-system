import React from 'react';

interface PageFlashMessageProps {
    open: boolean;
    message: string | null;
    type?: 'success' | 'error' | 'info' | 'warning';
    autoCloseMs?: number;
    onClose: () => void;
}

const palette: Record<string, { bg: string; color: string; border: string }> = {
    success: {
        bg: 'color-mix(in oklab, var(--color-success) 10%, white)',
        color: 'var(--color-success-dark)',
        border: 'color-mix(in oklab, var(--color-success) 45%, white)',
    },
    error: {
        bg: 'var(--color-danger-bg)',
        color: 'var(--color-danger)',
        border: 'color-mix(in oklab, var(--color-danger) 55%, white)',
    },
    warning: {
        bg: '#fffbeb',
        color: '#b45309',
        border: '#f59e0b',
    },
    info: {
        bg: '#eff6ff',
        color: '#1d4ed8',
        border: '#60a5fa',
    },
};

export function PageFlashMessage({
    open,
    message,
    type = 'info',
    autoCloseMs = 3200,
    onClose,
}: PageFlashMessageProps) {
    React.useEffect(() => {
        if (!open || !message || autoCloseMs <= 0) return;
        const id = window.setTimeout(() => {
            onClose();
        }, autoCloseMs);
        return () => window.clearTimeout(id);
    }, [autoCloseMs, message, onClose, open]);

    if (!open || !message) return null;
    const currentPalette = palette[type] || palette.info;

    return (
        <div
            style={{
                position: 'fixed',
                left: '50%',
                bottom: 'calc(env(safe-area-inset-bottom, 0px) + 18px)',
                transform: 'translateX(-50%)',
                zIndex: 1600,
                width: 'min(92vw, 460px)',
                pointerEvents: 'none',
            }}
        >
            <button
                type='button'
                onClick={onClose}
                style={{
                    width: '100%',
                    pointerEvents: 'auto',
                    border: `1px solid ${currentPalette.border}`,
                    background: currentPalette.bg,
                    color: currentPalette.color,
                    borderRadius: 14,
                    padding: '14px 16px',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.12)',
                    fontSize: 14,
                    fontWeight: 600,
                    textAlign: 'center',
                    cursor: 'pointer',
                }}
            >
                {message}
            </button>
        </div>
    );
}