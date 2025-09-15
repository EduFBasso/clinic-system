import React from 'react';
import AppModal from './Modal';
import {
    useAppointmentsRange,
    type Appointment,
} from '../hooks/useAppointments';
import type { ClientBasic } from '../types/ClientBasic';
import { useNow } from '../hooks/useNow';
import AppointmentCard from './AppointmentCard';
import { API_BASE } from '../config/api';

function startOfMonth(d: Date) {
    const x = new Date(d);
    x.setDate(1);
    x.setHours(0, 0, 0, 0);
    return x;
}
function endOfMonth(d: Date) {
    const x = startOfMonth(d);
    x.setMonth(x.getMonth() + 1);
    return x; // exclusive end
}

function toISODate(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

function groupByDay(items: Appointment[]) {
    const map: Record<string, Appointment[]> = {};
    items.forEach(a => {
        const k = toISODate(new Date(a.start_at));
        if (!map[k]) map[k] = [];
        map[k].push(a);
    });
    Object.values(map).forEach(list =>
        list.sort(
            (a, b) =>
                new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
        ),
    );
    return map;
}

export default function MonthlyAgendaModal({
    open,
    onClose,
    client,
    initialMonth,
}: {
    open: boolean;
    onClose: () => void;
    client: ClientBasic;
    initialMonth?: Date;
}) {
    const [month, setMonth] = React.useState<Date>(
        () => initialMonth || new Date(),
    );
    const start = React.useMemo(() => startOfMonth(month), [month]);
    const end = React.useMemo(() => endOfMonth(month), [month]);
    const { items, loading } = useAppointmentsRange(start, end, client.id);
    const grouped = React.useMemo(() => groupByDay(items), [items]);

    const y = month.getFullYear();
    const mName = month.toLocaleDateString('pt-BR', { month: 'long' });
    const now = useNow(30000);
    const [error, setError] = React.useState<string | null>(null);

    // Mantemos now para futuras evoluções (ex: highlight do dia corrente)
    void now;

    const monthValue = `${y}-${String(month.getMonth() + 1).padStart(2, '0')}`;

    return (
        <AppModal open={open} onClose={onClose} closeOnEnter={false}>
            <div style={{ display: 'grid', gap: 12 }}>
                {/* Header */}
                <div
                    style={{ fontWeight: 800, fontSize: 18, color: '#111827' }}
                >
                    Agenda mensal
                </div>
                {/* Name line */}
                <div
                    style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}
                >
                    <span
                        style={{
                            fontWeight: 700,
                            color: 'var(--color-primary)',
                            minWidth: 56,
                        }}
                    >
                        Nome:
                    </span>
                    <span style={{ color: 'var(--color-text)' }}>
                        {client.first_name} {client.last_name}
                    </span>
                </div>
                {/* Month control: arrows + clickable label (opens month picker) */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        justifyContent: 'center',
                    }}
                >
                    <button
                        aria-label='Mês anterior'
                        onClick={() => {
                            const d = new Date(month);
                            d.setMonth(d.getMonth() - 1);
                            setMonth(d);
                        }}
                    >
                        ◀
                    </button>
                    <button
                        onClick={() =>
                            document
                                .getElementById('hiddenMonthPicker')
                                ?.click()
                        }
                        style={{
                            minWidth: 180,
                            textAlign: 'center',
                            fontWeight: 800,
                            color: '#111827',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                        }}
                        title='Selecionar mês'
                    >
                        {mName.charAt(0).toUpperCase() + mName.slice(1)} {y}
                    </button>
                    <input
                        id='hiddenMonthPicker'
                        type='month'
                        value={monthValue}
                        onChange={e => {
                            const [yy, mm] = e.target.value
                                .split('-')
                                .map(Number);
                            const d = new Date(month);
                            d.setFullYear(yy);
                            d.setMonth((mm || 1) - 1);
                            d.setDate(1);
                            setMonth(d);
                        }}
                        style={{
                            position: 'absolute',
                            opacity: 0,
                            width: 0,
                            height: 0,
                            pointerEvents: 'none',
                        }}
                        aria-hidden='true'
                        tabIndex={-1}
                    />
                    <button
                        aria-label='Próximo mês'
                        onClick={() => {
                            const d = new Date(month);
                            d.setMonth(d.getMonth() + 1);
                            setMonth(d);
                        }}
                    >
                        ▶
                    </button>
                </div>

                {loading ? (
                    <div>Carregando…</div>
                ) : items.length === 0 ? (
                    <div>Nenhum compromisso neste mês.</div>
                ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                        {Object.keys(grouped)
                            .sort()
                            .map(dayISO => {
                                const day = new Date(dayISO);
                                const label = day.toLocaleDateString('pt-BR', {
                                    weekday: 'short',
                                    day: '2-digit',
                                    month: '2-digit',
                                });
                                return (
                                    <div
                                        key={dayISO}
                                        style={{ display: 'grid', gap: 6 }}
                                    >
                                        <div
                                            style={{
                                                fontWeight: 600,
                                                color: '#374151',
                                            }}
                                        >
                                            {label}
                                        </div>
                                        {grouped[dayISO].map(a => (
                                            <AppointmentCard
                                                key={a.id}
                                                appt={a as Appointment}
                                                onEdit={appt => {
                                                    const dayIso = toISODate(
                                                        new Date(appt.start_at),
                                                    );
                                                    const isMobile =
                                                        /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
                                                            window.navigator
                                                                .userAgent,
                                                        );
                                                    if (!isMobile) {
                                                        try {
                                                            window.dispatchEvent(
                                                                new CustomEvent(
                                                                    'openScheduleEdit',
                                                                    {
                                                                        detail: {
                                                                            client,
                                                                            date: new Date(
                                                                                dayIso +
                                                                                    'T00:00:00',
                                                                            ),
                                                                            appointment:
                                                                                appt,
                                                                        },
                                                                    },
                                                                ),
                                                            );
                                                            return;
                                                        } catch {
                                                            /* noop */
                                                        }
                                                    }
                                                    window.location.href = `/agenda?date=${dayIso}&client=${client.id}&edit=${appt.id}`;
                                                }}
                                                onCancel={async appt => {
                                                    try {
                                                        setError(null);
                                                        const token =
                                                            localStorage.getItem(
                                                                'accessToken',
                                                            );
                                                        const headers: Record<
                                                            string,
                                                            string
                                                        > = {
                                                            'Content-Type':
                                                                'application/json',
                                                        };
                                                        if (token)
                                                            headers[
                                                                'Authorization'
                                                            ] = `Bearer ${token}`;
                                                        const resp =
                                                            await fetch(
                                                                `${API_BASE}/agenda/appointments/${appt.id}/cancel/`,
                                                                {
                                                                    method: 'POST',
                                                                    headers,
                                                                },
                                                            );
                                                        if (!resp.ok) {
                                                            const txt =
                                                                await resp.text();
                                                            throw new Error(
                                                                txt ||
                                                                    'Erro ao cancelar',
                                                            );
                                                        }
                                                        // Mensagem global por 3s
                                                        try {
                                                            window.dispatchEvent(
                                                                new CustomEvent(
                                                                    'systemMessage',
                                                                    {
                                                                        detail: {
                                                                            text: 'Compromisso cancelado',
                                                                            type: 'success',
                                                                        },
                                                                    },
                                                                ),
                                                            );
                                                        } catch {
                                                            /* noop */
                                                        }
                                                        // Atualiza clientes
                                                        try {
                                                            window.dispatchEvent(
                                                                new Event(
                                                                    'updateClients',
                                                                ),
                                                            );
                                                        } catch {
                                                            /* noop */
                                                        }
                                                        // Fechar modal levemente depois para evitar corte visual abrupto
                                                        setTimeout(() => {
                                                            onClose();
                                                            // Após fechar, rola até cartão
                                                            setTimeout(() => {
                                                                try {
                                                                    window.dispatchEvent(
                                                                        new CustomEvent(
                                                                            'scrollToClientCard',
                                                                            {
                                                                                detail: {
                                                                                    clientId:
                                                                                        client.id,
                                                                                },
                                                                            },
                                                                        ),
                                                                    );
                                                                } catch {
                                                                    /* noop */
                                                                }
                                                            }, 120);
                                                        }, 140);
                                                    } catch (err) {
                                                        const msg =
                                                            err &&
                                                            typeof err ===
                                                                'object' &&
                                                            'message' in err
                                                                ? String(
                                                                      (
                                                                          err as Error
                                                                      ).message,
                                                                  )
                                                                : 'Erro ao cancelar';
                                                        setError(msg);
                                                        setTimeout(
                                                            () =>
                                                                setError(null),
                                                            4000,
                                                        );
                                                    }
                                                }}
                                            />
                                        ))}
                                    </div>
                                );
                            })}
                    </div>
                )}
                {error && (
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                        <span style={{ color: '#b91c1c', fontWeight: 600 }}>
                            {error}
                        </span>
                    </div>
                )}
            </div>
        </AppModal>
    );
}
