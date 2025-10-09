import React from 'react';
import { useResizeLayoutChange } from '../../hooks/useLayoutChangeEvent';

interface StickyModalHeaderProps {
    title: React.ReactNode;
    onClose?: () => void;
    children?: React.ReactNode; // second line content (e.g., date selectors)
    style?: React.CSSProperties;
}
// ForwardRef para permitir que consumidores (ex.: WeeklyAgendaModal) meçam a altura.
const StickyModalHeader = React.forwardRef<
    HTMLDivElement,
    StickyModalHeaderProps
>(({ title, onClose, children, style }, forwardedRef) => {
    const localRef = React.useRef<HTMLDivElement | null>(null);
    // Usa o ref de fora se fornecido; caso contrário usa local
    const ref =
        (forwardedRef as React.MutableRefObject<HTMLDivElement | null>) ||
        localRef;
    useResizeLayoutChange(ref);
    return (
        <div
            ref={ref}
            style={{
                position: 'sticky',
                top: 0,
                zIndex: 900,
                background: 'var(--color-bg)',
                borderBottom: '1px solid var(--color-border)',
                paddingTop: 'env(safe-area-inset-top, 0px)',
                ...style,
            }}
        >
            {/* Row 1: Title (left) + Close (right) */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    minWidth: 0,
                    paddingBottom: 6,
                }}
            >
                <div
                    style={{
                        fontWeight: 800,
                        fontSize: 'clamp(18px, 4.6vw, var(--font-title-lg))',
                        color: 'var(--color-heading)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        minWidth: 0,
                        flex: '1 1 auto',
                    }}
                >
                    {title}
                </div>
                {onClose && (
                    <button
                        type='button'
                        aria-label='Fechar'
                        onClick={onClose}
                        style={{
                            width: 44,
                            height: 44,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            color: 'var(--color-heading)',
                            fontSize: 26,
                        }}
                    >
                        ×
                    </button>
                )}
            </div>
            {/* Row 2: Custom controls (e.g., date selectors) */}
            {children ? (
                <div style={{ paddingBottom: 8 }}>{children}</div>
            ) : null}
        </div>
    );
});

StickyModalHeader.displayName = 'StickyModalHeader';

export default StickyModalHeader;
