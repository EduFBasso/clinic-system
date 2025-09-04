import React from 'react';
import AppModal from './Modal';
import {
    useAppointmentsRange,
    type Appointment,
} from '../hooks/useAppointments';
import type { ClientBasic } from '../types/ClientBasic';
import { useNow } from '../hooks/useNow';
import { FaEdit } from 'react-icons/fa';

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
                                        {grouped[dayISO].map(a => {
                                            const s = new Date(a.start_at);
                                            const e = new Date(a.end_at);
                                            const vis = statusVisual(a);
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
