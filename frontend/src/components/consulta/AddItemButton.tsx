import React from 'react';

const addBtnStyle: React.CSSProperties = {
    background: 'var(--color-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    width: 34,
    height: 34,
    fontSize: 22,
    lineHeight: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    margin: '0 auto',
    padding: 0,
    transition:
        'transform 120ms ease, background-color 120ms ease, box-shadow 160ms ease, opacity 120ms ease',
    WebkitTapHighlightColor: 'transparent',
};

interface AddItemButtonProps {
    title: string;
    onClick: () => void;
}

export default function AddItemButton({ title, onClick }: AddItemButtonProps) {
    const [pressed, setPressed] = React.useState(false);
    const [confirmed, setConfirmed] = React.useState(false);

    React.useEffect(() => {
        if (!confirmed) return;
        const timeoutId = window.setTimeout(() => setConfirmed(false), 240);
        return () => window.clearTimeout(timeoutId);
    }, [confirmed]);

    return (
        <button
            onClick={() => {
                setConfirmed(true);
                onClick();
            }}
            onMouseDown={() => setPressed(true)}
            onMouseUp={() => setPressed(false)}
            onMouseLeave={() => setPressed(false)}
            onTouchStart={() => setPressed(true)}
            onTouchEnd={() => setPressed(false)}
            onTouchCancel={() => setPressed(false)}
            onBlur={() => setPressed(false)}
            style={{
                ...addBtnStyle,
                transform: confirmed
                    ? 'scale(1.08)'
                    : pressed
                      ? 'scale(0.94)'
                      : 'scale(1)',
                boxShadow: confirmed
                    ? 'var(--shadow-soft-sm)'
                    : pressed
                      ? 'inset 0 2px 8px color-mix(in oklab, var(--color-primary) 45%, #0000)'
                      : 'var(--shadow-soft-sm)',
                opacity: pressed ? 0.96 : 1,
            }}
            title={title}
            aria-label={title}
            type='button'
        >
            <span
                aria-hidden='true'
                style={{
                    transform: confirmed ? 'scale(1.04)' : 'none',
                    transition: 'transform 120ms ease',
                }}
            >
                +
            </span>
        </button>
    );
}
