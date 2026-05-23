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
export function ModalActionsBar({
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
                alignItems: 'center',
                // Thin strip — just tall enough for the touch target
                minHeight: 44,
                padding: 0,
                // Subtle gradient so the X stays readable when content scrolls underneath
                background:
                    'linear-gradient(to bottom, var(--color-bg, #fff) 60%, transparent)',
                borderBottom: 'none',
                pointerEvents: 'none',
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
                        color: 'var(--color-heading)',
                        width: 44,
                        height: 44,
                        borderRadius: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent',
                        // Reabilita interação apenas no botão
                        pointerEvents: 'auto',
                    }}
                    title='Fechar'
                >
                    ×
                </button>
            )}
        </div>
    );
}
