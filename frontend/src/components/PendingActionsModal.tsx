import React from 'react';
import AppModal from './Modal';
import { clearOngoingSnapshot } from '../hooks/useOngoingSnapshot';
import { API_BASE } from '../config/api';
import type { SharedAppointmentLike } from './shared/AppointmentCard';
import { dispatchers } from '../events/dispatchers';
import { finalizeWithFallback } from '../services/appointments';
import { setAppointmentOverride } from '../utils/appointments/overrides';

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

    async function sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    type ApptStatus = 'scheduled' | 'done' | 'canceled' | 'unknown';
    async function fetchApptStatus(id: number): Promise<ApptStatus> {
        try {
            const token = localStorage.getItem('accessToken') || '';
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const r = await fetch(
                `${API_BASE}/agenda/appointments/${id}/?ts=${Date.now()}`,
                {
                    headers,
                    cache: 'no-store',
                },
            );
            if (!r.ok) return 'unknown';
            const data = (await r.json()) as { status?: string };
            const st = (data?.status || '').toLowerCase();
            if (st === 'scheduled' || st === 'done' || st === 'canceled')
                return st as ApptStatus;
            return 'unknown';
        } catch {
            return 'unknown';
        }
    }

    async function waitUntilFinalized(
        id: number,
        attempts = 4,
    ): Promise<boolean> {
        for (let i = 0; i < attempts; i++) {
            const st = await fetchApptStatus(id);
            if (st === 'done' || st === 'canceled') return true;
            if (st !== 'scheduled' && st !== 'unknown') return true; // qualquer outro estado não bloqueia
            await sleep(120 + i * 160);
        }
        return false;
    }

    React.useEffect(() => {
        // no-op for now; keeping hook structure if future fields appear
    }, [open]);

    if (!appt) return null;
    const apptId = appt.id; // safe after null check
    const apptClientId =
        typeof appt.client === 'number'
            ? appt.client
            : appt.client && 'id' in appt.client
            ? (appt.client as { id: number }).id
            : undefined;

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
            dispatchers.appointmentsChanged();
            dispatchers.updateClients();
            try {
                localStorage.setItem(
                    'appointments.changed',
                    String(Date.now()),
                );
            } catch {
                /* noop */
            }
            // Clear ongoing latch for this client in the same tab (avoids sticky 'em andamento')
            try {
                if (typeof apptClientId === 'number') {
                    window.dispatchEvent(
                        new CustomEvent('client:clearOngoing', {
                            detail: { clientId: apptClientId },
                        }),
                    );
                }
            } catch {
                /* noop */
            }
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
            const id = apptId;
            const ok = await finalizeWithFallback(id);
            if (!ok) throw new Error('Falha ao finalizar');
            try {
                setAppointmentOverride(id, { status: 'done' });
            } catch {
                /* noop */
            }
            const finalized = await waitUntilFinalized(id, 5);
            try {
                window.dispatchEvent(
                    new CustomEvent('systemMessage', {
                        detail: {
                            text: finalized
                                ? 'Atendimento marcado como concluído.'
                                : 'Concluído enviado. Atualizando…',
                            type: 'success',
                        },
                    }),
                );
            } catch {
                /* noop */
            }
            // Dispara eventos de atualização com pequeno backoff para evitar corrida
            try {
                // Limpa snapshot local, caso exista (garante remoção do estilo de atendimento)
                if (typeof apptClientId === 'number') {
                    clearOngoingSnapshot(apptClientId);
                }
                // Coalesce refresh events to avoid bursts
                dispatchers.appointmentsChanged();
                dispatchers.updateClients();
                try {
                    localStorage.setItem(
                        'appointments.changed',
                        String(Date.now()),
                    );
                } catch {
                    /* noop */
                }
                // Clear ongoing latch for this client in the same tab (evita visual colado)
                if (typeof apptClientId === 'number') {
                    window.dispatchEvent(
                        new CustomEvent('client:clearOngoing', {
                            detail: { clientId: apptClientId },
                        }),
                    );
                }
            } catch {
                /* noop */
            }
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
