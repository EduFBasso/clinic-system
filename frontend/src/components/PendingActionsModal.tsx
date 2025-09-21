import React from 'react';
import AppModal from './Modal';
import { API_BASE } from '../config/api';
import type { SharedAppointmentLike } from './shared/AppointmentCard';

interface PendingActionsModalProps {
    open: boolean;
    onClose: () => void;
    appt: SharedAppointmentLike | null;
}

const labelStyle: React.CSSProperties = {
    fontSize: 14,
    color: '#374151',
    fontWeight: 700,
};

const valueStyle: React.CSSProperties = {
    fontSize: 14,
    color: '#111827',
};

export default function PendingActionsModal({
    open,
    onClose,
    appt,
}: PendingActionsModalProps) {
    const [busy, setBusy] = React.useState<'cancel' | 'finalize' | null>(null);

    React.useEffect(() => {
        // no-op for now; keeping hook structure if future fields appear
    }, [open]);

    if (!appt) return null;
    const apptId = appt.id; // safe after null check

    const clientName =
        appt.client_name ||
        (typeof appt.client === 'object' && appt.client && 'name' in appt.client
            ? String((appt.client as { name?: string }).name || 'Cliente')
            : 'Cliente');

    const s = new Date(appt.start_at);
    const e = new Date(appt.end_at);
    const timeRange = `${s
        .toLocaleDateString('pt-BR', { weekday: 'short' })
        .replace('.', '')} ${String(s.getDate()).padStart(2, '0')}/${String(
        s.getMonth() + 1,
    ).padStart(2, '0')}, ${s.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    })} - ${e.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    })}`;

    async function doCancel() {
        if (busy) return;
        setBusy('cancel');
        try {
            const token = localStorage.getItem('accessToken') || '';
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const id = apptId;
            // Agora: cancelamento simples sem motivo (backend ainda não coleta motivos)
            const resp = await fetch(
                `${API_BASE}/agenda/appointments/${id}/cancel/`,
                { method: 'POST', headers },
            );
            if (!resp.ok) throw new Error(await resp.text());
            try {
                window.dispatchEvent(
                    new CustomEvent('systemMessage', {
                        detail: {
                            text: 'Compromisso cancelado.',
                            type: 'success',
                        },
                    }),
                );
            } catch {
                /* noop */
            }
            window.dispatchEvent(new Event('appointments:changed'));
            window.dispatchEvent(new Event('updateClients'));
            onClose();
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Falha ao cancelar';
            try {
                window.dispatchEvent(
                    new CustomEvent('systemMessage', {
                        detail: { text: msg, type: 'error' },
                    }),
                );
            } catch {
                /* noop */
            }
        } finally {
            setBusy(null);
        }
    }

    async function doFinalize() {
        if (busy) return;
        setBusy('finalize');
        try {
            const token = localStorage.getItem('accessToken') || '';
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const id = apptId;
            const r = await fetch(`${API_BASE}/agenda/appointments/${id}/`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ status: 'done' }),
            });
            if (!r.ok) throw new Error(await r.text());
            try {
                window.dispatchEvent(
                    new CustomEvent('systemMessage', {
                        detail: {
                            text: 'Atendimento marcado como concluído.',
                            type: 'success',
                        },
                    }),
                );
            } catch {
                /* noop */
            }
            window.dispatchEvent(new Event('appointments:changed'));
            window.dispatchEvent(new Event('updateClients'));
            onClose();
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Falha ao concluir';
            try {
                window.dispatchEvent(
                    new CustomEvent('systemMessage', {
                        detail: { text: msg, type: 'error' },
                    }),
                );
            } catch {
                /* noop */
            }
        } finally {
            setBusy(null);
        }
    }

    return (
        <AppModal open={open} onClose={onClose} closeOnEnter={false}>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    minWidth: 320,
                }}
            >
                <h3 style={{ margin: 0 }}>Consulta — Ação em Pendente</h3>
                <div style={{ display: 'grid', gap: 6 }}>
                    <div>
                        <span style={labelStyle}>Cliente: </span>
                        <span style={valueStyle}>{clientName}</span>
                    </div>
                    <div>
                        <span style={labelStyle}>Horário: </span>
                        <span style={valueStyle}>{timeRange}</span>
                    </div>
                </div>
                {/* Campo de motivo removido por ora. Backend ainda não coleta. */}
                <div
                    style={{
                        display: 'flex',
                        gap: 8,
                        justifyContent: 'flex-end',
                        marginTop: 4,
                    }}
                >
                    <button
                        onClick={onClose}
                        style={{ padding: '8px 12px', background: '#e5e7eb' }}
                        disabled={!!busy}
                    >
                        Fechar
                    </button>
                    <button
                        onClick={doFinalize}
                        disabled={!!busy}
                        style={{
                            padding: '8px 12px',
                            background: 'var(--color-done)',
                            color: '#fff',
                            fontWeight: 700,
                            border: '1px solid color-mix(in oklab, var(--color-done) 60%, #0000)',
                        }}
                        title='Marcar como concluído'
                    >
                        {busy === 'finalize' ? 'Concluindo…' : 'Concluir'}
                    </button>
                    <button
                        onClick={doCancel}
                        disabled={!!busy}
                        style={{
                            padding: '8px 12px',
                            background: '#ef4444',
                            color: '#fff',
                            fontWeight: 700,
                        }}
                        title='Cancelar compromisso'
                    >
                        {busy === 'cancel' ? 'Cancelando…' : 'Cancelar'}
                    </button>
                </div>
            </div>
        </AppModal>
    );
}
