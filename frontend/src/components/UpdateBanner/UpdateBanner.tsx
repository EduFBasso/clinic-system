// src/components/UpdateBanner.tsx

type Props = {
    onReload: () => void;
    onDismiss?: () => void;
    message?: string;
};

export function UpdateBanner({ onReload, onDismiss, message }: Props) {
    return (
        <div
            style={{
                position: 'fixed',
                bottom: 12,
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#0f172a',
                color: 'white',
                padding: '10px 14px',
                borderRadius: 10,
                boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
                zIndex: 9999,
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                maxWidth: '92vw',
            }}
            role='status'
            aria-live='polite'
        >
            <span style={{ fontSize: 14 }}>
                {message || 'Nova versão disponível'}
            </span>
            <button
                onClick={onReload}
                style={{
                    background: '#22c55e',
                    color: '#0a0a0a',
                    border: 0,
                    padding: '6px 10px',
                    borderRadius: 8,
                    fontWeight: 600,
                }}
            >
                Atualizar
            </button>
            {onDismiss && (
                <button
                    onClick={onDismiss}
                    style={{
                        background: 'transparent',
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.25)',
                        padding: '6px 10px',
                        borderRadius: 8,
                    }}
                >
                    Depois
                </button>
            )}
        </div>
    );
}
