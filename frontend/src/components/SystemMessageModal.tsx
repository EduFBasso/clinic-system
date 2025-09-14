import React from 'react';
import AppModal from './Modal';

interface SystemMessageModalProps {
    open: boolean;
    message: string | null;
    type?: 'success' | 'error' | 'info';
    onClose: () => void;
    autoCloseMs?: number;
}

const palette: Record<string, { bg: string; color: string; border: string }> = {
    success: { bg: '#ecfdf5', color: '#065f46', border: '#34d399' },
    error: { bg: '#fef2f2', color: '#b91c1c', border: '#f87171' },
    info: { bg: '#eff6ff', color: '#1d4ed8', border: '#60a5fa' },
};

export default function SystemMessageModal({
    open,
    message,
    type = 'info',
    onClose,
    autoCloseMs = 3000,
}: SystemMessageModalProps) {
    const timerRef = React.useRef<number | null>(null);
    const wrappedClose = React.useCallback(() => {
        try {
            console.debug('[SystemMessageModal] closing modal');
        } catch {
            /* noop */
        }
        try {
            // Reforço: caso a sequência de modais deixe body travado
            window.dispatchEvent(new Event('ensureScrollUnlocked'));
        } catch {
            /* noop */
        }
        // Re-dispacha updateClients se mensagem de sucesso de criação/atualização (heurística simples pelo texto)
        try {
            if (message && /Compromisso (criado|atualizado)/i.test(message)) {
                window.dispatchEvent(new Event('updateClients'));
                console.debug(
                    '[SystemMessageModal] re-dispatch updateClients (heuristic)',
                );
            }
        } catch {
            /* noop */
        }
        onClose();
    }, [onClose, message]);
    React.useEffect(() => {
        if (open && autoCloseMs > 0) {
            timerRef.current = window.setTimeout(() => {
                wrappedClose();
            }, autoCloseMs);
        }
        return () => {
            if (timerRef.current) window.clearTimeout(timerRef.current);
        };
    }, [open, autoCloseMs, wrappedClose]);

    if (!open || !message) return null;
    const p = palette[type] || palette.info;
    if (!palette[type]) {
        try {
            console.warn(
                '[SystemMessageModal] Tipo de mensagem desconhecido recebido:',
                type,
                '-> usando info',
            );
        } catch {
            /* noop */
        }
    }
    return (
        <AppModal open={open} onClose={wrappedClose} closeOnEnter={false}>
            <div
                style={{
                    minWidth: 280,
                    maxWidth: 420,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    background: p.bg,
                    padding: '18px 20px',
                    border: `1px solid ${p.border}`,
                    borderRadius: 12,
                    color: p.color,
                    fontWeight: 600,
                    textAlign: 'center',
                }}
            >
                <div style={{ fontSize: 15 }}>{message}</div>
                <button
                    onClick={wrappedClose}
                    style={{
                        background: p.color,
                        color: '#fff',
                        border: 'none',
                        padding: '8px 14px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontWeight: 600,
                    }}
                >
                    Fechar
                </button>
                <div style={{ fontSize: 11, opacity: 0.65 }}>
                    Fecha automaticamente em {Math.round(autoCloseMs / 1000)}s
                </div>
            </div>
        </AppModal>
    );
}
