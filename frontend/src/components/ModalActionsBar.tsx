import React from 'react';

export interface ModalActionsBarProps {
    onClose: () => void;
    showCloseButton?: boolean;
    // Optional style/class to allow fine-tuning per modal
    style?: React.CSSProperties;
    className?: string;
}

/**
 * Sticky actions header for modals: renders a transparent close button (X)
 * no topo-direito. Fica visível enquanto o conteúdo do modal rola.
 */
export default function ModalActionsBar({
    onClose,
    showCloseButton = true,
    style,
    className,
}: ModalActionsBarProps) {
    return (
        <div
            className={className}
            style={{
                position: 'sticky',
                top: 0,
                zIndex: 1000,
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                padding: '0 4px 0 6px',
                // Opaque background to prevent content showing through under the top bar
                background: 'var(--color-bg)',
                borderBottom: '1px solid var(--color-border)',
                ...style,
            }}
        >
            {showCloseButton && (
                <button
                    aria-label='Fechar'
                    onClick={onClose}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        fontSize: 22,
                        cursor: 'pointer',
                        color: '#111827',
                        width: 44,
                        height: 44,
                        borderRadius: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent',
                    }}
                    title='Fechar'
                >
                    ×
                </button>
            )}
        </div>
    );
}
