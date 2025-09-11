import React from 'react';
import AppModal from './Modal';
import {
    useAppointmentsRange,
    type Appointment,
} from '../hooks/useAppointments';
import type { ClientBasic } from '../types/ClientBasic';
import { useNow } from '../hooks/useNow';
import { FaEdit } from 'react-icons/fa';

function toISODate(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

function formatTime(dt: Date) {
    return dt.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    });
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

type MonthlyAgendaModalProps = {
    open: boolean; // padronizado (antes: show)
    onClose: () => void;
    client: ClientBasic; // padronizado (antes: clientId string/number)
    initialMonth?: Date; // padronizado (antes: initialDay)
    infoMessage?: string; // opcional: banner contextual no topo
};

export default function MonthlyAgendaModal(props: MonthlyAgendaModalProps) {
    const { open, onClose, client, initialMonth, infoMessage } = props;

    // estado do mês + sync com props
    const [monthRef, setMonthRef] = React.useState<Date>(
        initialMonth ?? new Date(),
    );
    React.useEffect(() => {
        setMonthRef(initialMonth ?? new Date());
    }, [initialMonth]);

    const start = new Date(
        monthRef.getFullYear(),
        monthRef.getMonth(),
        1,
        0,
        0,
        0,
        0,
    );
    const end = new Date(
        monthRef.getFullYear(),
        monthRef.getMonth() + 1,
        1,
        0,
        0,
        0,
        0,
    );

    const clientId = client?.id; // corrigido: número
    const { items, loading } = useAppointmentsRange(start, end, clientId);
    const grouped = React.useMemo(() => groupByDay(items), [items]);

    const y = monthRef.getFullYear();
    const mName = monthRef.toLocaleDateString('pt-BR', { month: 'long' });
    const now = useNow(30000);

    // Colors consistent with AgendaPage
    const COLOR = {
        scheduled: { fg: '#059669', bg: '#f0fdf4' },
        done: { fg: '#065f46', bg: '#ecfdf5' },
        canceled: { fg: '#b91c1c', bg: '#fef2f2' },
        expired: { fg: '#6b7280', bg: '#f3f4f6' },
        ongoing: { fg: '#b45309', bg: '#fffbeb' },
    } as const;

    function statusVisual(a: Appointment) {
        const start = new Date(a.start_at);
        const end = new Date(a.end_at);
        const isExpired =
            a.status === 'scheduled' && end.getTime() <= now.getTime();
        const isOngoing =
            a.status === 'scheduled' &&
            start.getTime() <= now.getTime() &&
            now.getTime() < end.getTime();
        if (isExpired) return { label: 'Vencido', ...COLOR.expired };
        if (isOngoing) return { label: 'Em Atendimento', ...COLOR.ongoing };
        if (a.status === 'scheduled')
            return { label: 'Agendado', ...COLOR.scheduled };
        if (a.status === 'done') return { label: 'Realizado', ...COLOR.done };
        return { label: 'Cancelado', ...COLOR.canceled };
    }

    const monthValue = `${y}-${String(monthRef.getMonth() + 1).padStart(
        2,
        '0',
    )}`;

    if (!open) return null;

    return (
        <AppModal open={open} onClose={onClose}>
            <div style={{ display: 'grid', gap: 12 }}>
                {/* Header */}
                <div
                    style={{ fontWeight: 800, fontSize: 18, color: '#111827' }}
                >
                    Agenda mensal
                </div>

                {/* Nome do cliente (corrigido: usar client) */}
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
                    <div>
                        <strong>
                            {client?.first_name} {client?.last_name}
                        </strong>
                    </div>
                </div>

                {/* Controle de mês */}
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
                            const d = new Date(monthRef);
                            d.setMonth(d.getMonth() - 1);
                            setMonthRef(d);
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
                            const d = new Date(monthRef);
                            d.setFullYear(yy);
                            d.setMonth((mm || 1) - 1);
                            d.setDate(1);
                            setMonthRef(d);
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
                            const d = new Date(monthRef);
                            d.setMonth(d.getMonth() + 1);
                            setMonthRef(d);
                        }}
                    >
                        ▶
                    </button>
                </div>

                {/* Banner contextual (mensagem de “nenhum compromisso em <mês/ano>”) */}
                {infoMessage && (
                    <div
                        style={{
                            margin: '8px 0 10px',
                            padding: '8px 10px',
                            background: '#F0FDF4',
                            border: '1px solid #86EFAC',
                            color: '#065F46',
                            borderRadius: 6,
                            fontSize: 12,
                            lineHeight: 1.35,
                        }}
                    >
                        {infoMessage}
                    </div>
                )}

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
                                        {grouped[dayISO].map(a => {
                                            const s = new Date(a.start_at);
                                            const e = new Date(a.end_at);
                                            const vis = statusVisual(a);
                                            const isMobile =
                                                /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
                                                    window.navigator.userAgent,
                                                );
                                            return (
                                                <div
                                                    key={a.id}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 10,
                                                        padding: '10px 12px',
                                                        border: `1px solid ${vis.bg}`,
                                                        borderRadius: 10,
                                                        background: vis.bg,
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            width: 86,
                                                            color: '#111827',
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        {formatTime(s)} -{' '}
                                                        {formatTime(e)}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div
                                                            style={{
                                                                fontWeight: 700,
                                                                color: '#111827',
                                                            }}
                                                        >
                                                            {a.title ||
                                                                'Consulta'}
                                                        </div>
                                                        {a.notes ? (
                                                            <div
                                                                style={{
                                                                    color: '#374151',
                                                                    fontSize: 13,
                                                                }}
                                                            >
                                                                {a.notes}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                    <div
                                                        title={vis.label}
                                                        style={{
                                                            fontSize: 12,
                                                            fontWeight: 800,
                                                            color: vis.fg,
                                                            textTransform:
                                                                'uppercase',
                                                            marginRight: 8,
                                                        }}
                                                    >
                                                        {vis.label}
                                                    </div>
                                                    <button
                                                        title='Editar'
                                                        onClick={() => {
                                                            const dayIso =
                                                                toISODate(
                                                                    new Date(
                                                                        a.start_at,
                                                                    ),
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
                                                                                        a,
                                                                                },
                                                                            },
                                                                        ),
                                                                    );
                                                                    return;
                                                                } catch {
                                                                    /* noop */
                                                                }
                                                            }
                                                            window.location.href = `/agenda?date=${dayIso}&client=${client.id}&edit=${a.id}`;
                                                        }}
                                                        style={{
                                                            background:
                                                                'transparent',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            color: vis.fg,
                                                        }}
                                                    >
                                                        <FaEdit />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                    </div>
                )}
            </div>
        </AppModal>
    );
}
