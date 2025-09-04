import React from 'react';
import AppModal from './Modal';
import { useAppointmentsRange } from '../hooks/useAppointments';
import type { ClientBasic } from '../types/ClientBasic';
import { useNow } from '../hooks/useNow';
// Removed legacy QuickScheduleModal component during agenda consolidation.
export {};
function startOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}
function endOfDay(d: Date) {
    const x = startOfDay(d);
    x.setDate(x.getDate() + 1);
    return x;
}
function addDays(d: Date, n: number) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
}
function toISODate(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}
function fmtTime(d: Date) {
    return d.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function buildDefaultSlots(start: Date, end: Date) {
    // 08:00-20:00, steps of 60m
    const slots: { dayISO: string; start: Date; end: Date }[] = [];
    for (let d = new Date(start); d < end; d = addDays(d, 1)) {
        const dayISO = toISODate(d);
        for (let h = 8; h < 20; h++) {
            const s = new Date(d);
            s.setHours(h, 0, 0, 0);
            const e = new Date(d);
            e.setHours(h + 1, 0, 0, 0);
            slots.push({ dayISO, start: s, end: e });
        }
    }
    return slots;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
    // half-open [start,end)
    return aStart < bEnd && aEnd > bStart;
}

export default function QuickScheduleModal({
    open,
    onClose,
    client,
    initialDay,
}: {
    open: boolean;
    onClose: () => void;
    client: ClientBasic;
    initialDay?: Date;
}) {
    const now = useNow(30000);
    const [selectedDay, setSelectedDay] = React.useState<Date>(() =>
        startOfDay(initialDay ?? new Date()),
    );
    React.useEffect(() => {
        if (open && initialDay) {
            setSelectedDay(startOfDay(initialDay));
        }
    }, [open, initialDay]);
    const rangeStart = React.useMemo(
        () => startOfDay(selectedDay),
        [selectedDay],
    );
    const rangeEnd = React.useMemo(() => endOfDay(selectedDay), [selectedDay]);
    const { items, loading } = useAppointmentsRange(rangeStart, rangeEnd);

    // Precompute free/occupied slots
    const slots = React.useMemo(
        () => buildDefaultSlots(rangeStart, rangeEnd),
        [rangeStart, rangeEnd],
    );
    const taken = items.filter(a => a.status !== 'canceled');
    const dayISO = React.useMemo(() => toISODate(rangeStart), [rangeStart]);
    const daySlots = React.useMemo(() => {
        const list = [] as { start: Date; end: Date; busy: boolean }[];
        for (const slot of slots) {
            const busy = taken.some(a =>
                overlaps(
                    slot.start,
                    slot.end,
                    new Date(a.start_at),
                    new Date(a.end_at),
                ),
            );
            list.push({ start: slot.start, end: slot.end, busy });
        }
        list.sort((a, b) => a.start.getTime() - b.start.getTime());
        return list;
    }, [slots, taken]);

    // Colors aligned with Agenda
    const COLOR = {
        free: { fg: '#059669', bg: '#ecfdf5', bar: '#059669' },
        busy: { fg: '#6b7280', bg: '#f3f4f6', bar: '#6b7280' },
        now: { fg: '#b45309', bg: '#fffbeb', bar: '#b45309' },
    } as const;

    return (
        <AppModal open={open} onClose={onClose} closeOnEnter={false}>
            <div style={{ display: 'grid', gap: 12 }}>
                <div
                    style={{ fontWeight: 800, fontSize: 18, color: '#111827' }}
                >
                    Agendar rápido
                </div>
                {/* Date controls: prev, date picker, next */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        justifyContent: 'center',
                    }}
                >
                    <button
                        aria-label='Dia anterior'
                        onClick={() => setSelectedDay(d => addDays(d, -1))}
                        style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: '1px solid #e5e7eb',
                            background: '#ffffff',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                        }}
                    >
                        ◀
                    </button>
                    <input
                        type='date'
                        value={dayISO}
                        onChange={e =>
                            setSelectedDay(
                                startOfDay(
                                    new Date(e.target.value + 'T00:00:00'),
                                ),
                            )
                        }
                        style={{ padding: 6 }}
                    />
                    <button
                        aria-label='Próximo dia'
                        onClick={() => setSelectedDay(d => addDays(d, 1))}
                        style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: '1px solid #e5e7eb',
                            background: '#ffffff',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                        }}
                    >
                        ▶
                    </button>
                </div>
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
                {loading ? (
                    <div>Carregando…</div>
                ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                        <div style={{ fontWeight: 700, color: '#374151' }}>
                            {new Date(dayISO).toLocaleDateString('pt-BR', {
                                weekday: 'short',
                                day: '2-digit',
                                month: '2-digit',
                            })}
                        </div>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr',
                                gap: 8,
                            }}
                        >
                            {daySlots.map(slot => {
                                const isNow =
                                    slot.start.getTime() <= now.getTime() &&
                                    now.getTime() < slot.end.getTime();
                                const palette = slot.busy
                                    ? COLOR.busy
                                    : isNow
                                    ? COLOR.now
                                    : COLOR.free;
                                return (
                                    <div key={slot.start.toISOString()}>
                                        <div
                                            role={
                                                !slot.busy
                                                    ? 'button'
                                                    : undefined
                                            }
                                            onClick={() => {
                                                if (slot.busy) return;
                                                const y =
                                                    slot.start.getFullYear();
                                                const m = String(
                                                    slot.start.getMonth() + 1,
                                                ).padStart(2, '0');
                                                const d = String(
                                                    slot.start.getDate(),
                                                ).padStart(2, '0');
                                                const s = fmtTime(
                                                    slot.start,
                                                ).slice(0, 5);
                                                const e = fmtTime(
                                                    slot.end,
                                                ).slice(0, 5);
                                                window.location.href = `/agenda?date=${y}-${m}-${d}&client=${client.id}&new=1&start=${s}&end=${e}`;
                                            }}
                                            style={{
                                                padding: '10px 12px',
                                                border: `1px solid ${palette.bg}`,
                                                borderLeft: `6px solid ${palette.bar}`,
                                                background: palette.bg,
                                                borderRadius: 10,
                                                color: palette.fg,
                                                fontWeight: 700,
                                                cursor: slot.busy
                                                    ? 'not-allowed'
                                                    : 'pointer',
                                                opacity: slot.busy ? 0.6 : 1,
                                            }}
                                            title={
                                                slot.busy
                                                    ? 'Ocupado'
                                                    : 'Toque para agendar'
                                            }
                                        >
                                            <div>
                                                {fmtTime(slot.start)} -{' '}
                                                {fmtTime(slot.end)}
                                            </div>
                                            {!slot.busy ? (
                                                <div
                                                    style={{
                                                        fontWeight: 600,
                                                        color: '#374151',
                                                    }}
                                                >
                                                    Livre
                                                </div>
                                            ) : (
                                                <div
                                                    style={{
                                                        fontWeight: 600,
                                                        color: '#374151',
                                                    }}
                                                >
                                                    Ocupado
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </AppModal>
    );
}
