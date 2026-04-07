import React from 'react';
import { emit } from '../events/bus';
import {
    useAppointmentsRange,
    type Appointment,
} from '../hooks/useAppointments';
import { enrichAppointment } from '../utils/appointments/status';
import DateControlsHeader from './shared/DateControlsHeader';
import FloatingDatePicker from './FloatingDatePicker';

type StatusFilter = 'all' | 'pending' | 'active' | 'done' | 'canceled';

const MAX_BADGES = 5;

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;
const WEEKDAY_COLORS: Record<string, string | undefined> = { Dom: '#dc2626' };

function toISODate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatTime(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatClientName(name: string | undefined): string {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function statusColors(status: Appointment['status'] | 'past'): {
    border: string;
    bg: string;
    text: string;
} {
    switch (status) {
        case 'scheduled':
            return {
                border: 'var(--color-success)',
                bg: 'var(--color-success-bg)',
                text: 'var(--color-success)',
            };
        case 'past':
            return {
                border: 'var(--color-pending)',
                bg: 'var(--color-pending-bg)',
                text: 'var(--color-pending)',
            };
        case 'ongoing':
            return {
                border: 'var(--color-ongoing)',
                bg: 'var(--color-ongoing-bg)',
                text: 'var(--color-ongoing)',
            };
        case 'done':
            return {
                border: 'var(--color-done)',
                bg: 'var(--color-done-bg)',
                text: 'var(--color-done)',
            };
        case 'canceled':
            return {
                border: 'var(--color-canceled)',
                bg: 'var(--color-canceled-bg)',
                text: 'var(--color-canceled)',
            };
        default:
            return {
                border: 'var(--color-pending)',
                bg: 'var(--color-pending-bg)',
                text: 'var(--color-pending)',
            };
    }
}

function buildCalendarWeeks(year: number, month: number): (Date | null)[][] {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    // Convert Sun=0..Sat=6 → Mon=0..Sun=6
    const startDow = (firstDay.getDay() + 6) % 7;
    const totalDays = lastDay.getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
}

function groupByDay(items: Appointment[]): Record<string, Appointment[]> {
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

export default function AgendaMonthlyGrid() {
    const todayISO = React.useMemo(() => toISODate(new Date()), []);

    // Ticks every minute so time-based enrichment (ongoing) stays accurate
    const [now, setNow] = React.useState(() => new Date());
    React.useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(id);
    }, []);

    const [anchorMonth, setAnchorMonth] = React.useState<Date>(() => {
        const t = new Date();
        return new Date(t.getFullYear(), t.getMonth(), 1);
    });

    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
    const [showPicker, setShowPicker] = React.useState(false);

    const monthStart = React.useMemo(
        () => new Date(anchorMonth.getFullYear(), anchorMonth.getMonth(), 1),
        [anchorMonth],
    );
    const monthEnd = React.useMemo(
        () =>
            new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() + 1, 1),
        [anchorMonth],
    );

    const { items, loading } = useAppointmentsRange(monthStart, monthEnd);

    const filtered = React.useMemo(() => {
        if (statusFilter === 'all') return items;
        // Use fresh Date() for accuracy; `now` state exists only to trigger
        // re-renders every minute so ongoing status updates automatically.
        const currentNow = new Date();
        if (statusFilter === 'pending')
            return items.filter(a => {
                const e = enrichAppointment(a, currentNow);
                return e._derivedStatus === 'past';
            });
        if (statusFilter === 'active')
            return items.filter(a => {
                const e = enrichAppointment(a, currentNow);
                return (
                    e._derivedStatus === 'scheduled' ||
                    e._derivedStatus === 'ongoing' ||
                    a.status === 'ongoing'
                );
            });
        if (statusFilter === 'done')
            return items.filter(a => a.status === 'done');
        if (statusFilter === 'canceled')
            return items.filter(a => a.status === 'canceled');
        return items;
    }, [items, statusFilter, now]);

    const grouped = React.useMemo(() => groupByDay(filtered), [filtered]);

    const weeks = React.useMemo(
        () =>
            buildCalendarWeeks(
                anchorMonth.getFullYear(),
                anchorMonth.getMonth(),
            ),
        [anchorMonth],
    );

    const monthLabel = anchorMonth.toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
    });
    const monthLabelCap =
        monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

    function prevMonth() {
        setAnchorMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
    }
    function nextMonth() {
        setAnchorMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));
    }
    function goToday() {
        const t = new Date();
        setAnchorMonth(new Date(t.getFullYear(), t.getMonth(), 1));
    }

    function handleDayClick(d: Date) {
        // Emit with local noon (T12:00:00) so new Date() in the handler
        // won't shift the day due to UTC-offset (e.g. UTC-3 would turn
        // '2026-04-04' midnight UTC into April 3 local time).
        const iso = `${toISODate(d)}T12:00:00`;
        emit('openDailyAgenda', { date: iso });
    }

    return (
        <div style={{ padding: '0 16px 24px' }}>
            {/* Navigation + Filter pills — mesma linha no desktop */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 12,
                }}
            >
                <div style={{ flex: 1, minWidth: 0 }}>
                    <DateControlsHeader
                        currentDate={monthStart}
                        label={monthLabelCap}
                        onPrev={prevMonth}
                        onNext={nextMonth}
                        onToday={goToday}
                        onOpenPicker={() => setShowPicker(true)}
                    />
                </div>

                {/* Filter pills */}
                <div
                    style={{
                        display: 'flex',
                        gap: 4,
                        flexShrink: 0,
                    }}
                >
                    {(
                        [
                            'all',
                            'pending',
                            'active',
                            'done',
                            'canceled',
                        ] as StatusFilter[]
                    ).map(f => {
                        const label =
                            f === 'all'
                                ? 'Todos'
                                : f === 'pending'
                                  ? 'Pendentes'
                                  : f === 'active'
                                    ? 'Ativos'
                                    : f === 'done'
                                      ? 'Concluídos'
                                      : 'Cancelados';
                        const isSelected = statusFilter === f;
                        const activeBg =
                            f === 'pending'
                                ? 'var(--color-pending)'
                                : f === 'active'
                                  ? 'var(--color-ongoing)'
                                  : f === 'done'
                                    ? 'var(--color-done)'
                                    : f === 'canceled'
                                      ? 'var(--color-canceled)'
                                      : 'var(--color-heading)';
                        return (
                            <button
                                key={f}
                                onClick={() => setStatusFilter(f)}
                                style={{
                                    padding: '4px 12px',
                                    borderRadius: 20,
                                    border: '1px solid var(--color-border)',
                                    background: isSelected
                                        ? activeBg
                                        : 'transparent',
                                    color: isSelected
                                        ? '#fff'
                                        : 'var(--color-text-muted)',
                                    fontSize: '0.8rem',
                                    fontWeight: isSelected ? 700 : 400,
                                    cursor: 'pointer',
                                    transition: 'background 0.15s, color 0.15s',
                                }}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div
                    style={{
                        textAlign: 'center',
                        padding: '6px 0 10px',
                        color: 'var(--color-disabled)',
                        fontSize: '0.82rem',
                    }}
                >
                    Carregando…
                </div>
            )}

            {/* Single unified grid: header row + all day cells */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: 2,
                    alignItems: 'start',
                }}
            >
                {/* Weekday header cells */}
                {WEEKDAYS.map(w => (
                    <div
                        key={w}
                        style={{
                            textAlign: 'center',
                            fontWeight: 600,
                            fontSize: '0.84rem',
                            color: WEEKDAY_COLORS[w] ?? 'var(--color-disabled)',
                            padding: '4px 0 6px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                        }}
                    >
                        {w}
                    </div>
                ))}

                {/* Day cells — flat list, grid auto-flows into rows of 7 */}
                {weeks.flat().map((day, di) => {
                    if (!day) {
                        return (
                            <div
                                key={`empty-${di}`}
                                style={{
                                    background: 'var(--color-bg)',
                                    minHeight: 150,
                                    borderRadius: 6,
                                }}
                            />
                        );
                    }
                    const iso = toISODate(day);
                    const dayAppts = grouped[iso] ?? [];
                    const visible = dayAppts.slice(0, MAX_BADGES);
                    const overflow = dayAppts.length - MAX_BADGES;
                    const isToday = iso === todayISO;

                    return (
                        <div
                            key={iso}
                            onClick={() => handleDayClick(day)}
                            style={{
                                background: 'var(--color-bg-section)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 6,
                                padding: '6px',
                                minHeight: 150,
                                cursor: 'pointer',
                                transition: 'transform 0.15s, box-shadow 0.15s',
                            }}
                            onMouseEnter={e => {
                                const el = e.currentTarget as HTMLDivElement;
                                el.style.transform = 'translateY(-3px)';
                                el.style.boxShadow =
                                    '0 6px 18px rgba(0,0,0,0.13)';
                                el.style.position = 'relative';
                                el.style.zIndex = '1';
                            }}
                            onMouseLeave={e => {
                                const el = e.currentTarget as HTMLDivElement;
                                el.style.transform = '';
                                el.style.boxShadow = '';
                                el.style.position = '';
                                el.style.zIndex = '';
                            }}
                        >
                            {/* Day number + HOJE badge */}
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    marginBottom: 4,
                                }}
                            >
                                <div
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: 24,
                                        height: 24,
                                        borderRadius: '50%',
                                        background: isToday
                                            ? 'var(--color-heading)'
                                            : 'transparent',
                                        color: isToday
                                            ? '#fff'
                                            : 'var(--color-heading)',
                                        fontWeight: isToday ? 800 : 600,
                                        fontSize: '0.85rem',
                                        flexShrink: 0,
                                    }}
                                >
                                    {day.getDate()}
                                </div>
                                {isToday && (
                                    <span
                                        style={{
                                            fontSize: '0.72rem',
                                            fontWeight: 700,
                                            color: '#ea580c',
                                            letterSpacing: '0.04em',
                                            textTransform: 'uppercase',
                                        }}
                                    >
                                        Hoje
                                    </span>
                                )}
                            </div>

                            {/* Appointments or empty placeholder */}
                            {dayAppts.length === 0 ? (
                                <div
                                    style={{
                                        color: 'var(--color-disabled)',
                                        fontSize: '0.72rem',
                                    }}
                                >
                                    --
                                </div>
                            ) : (
                                <>
                                    {visible.map(a => {
                                        const enriched = enrichAppointment(
                                            a,
                                            new Date(),
                                        );
                                        const { border, bg, text } =
                                            statusColors(
                                                enriched._derivedStatus,
                                            );
                                        const label = `${formatTime(a.start_at)} · ${formatClientName(a.client_name)}`;
                                        return (
                                            <div
                                                key={a.id}
                                                title={label}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    marginBottom: 3,
                                                    borderRadius: 3,
                                                    background: bg,
                                                    overflow: 'hidden',
                                                    fontSize: '0.68rem',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: 3,
                                                        alignSelf: 'stretch',
                                                        background: border,
                                                        flexShrink: 0,
                                                    }}
                                                />
                                                <div
                                                    style={{
                                                        padding: '2px 4px',
                                                        color: text,
                                                        fontWeight: 600,
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow:
                                                            'ellipsis',
                                                        lineHeight: 1.4,
                                                    }}
                                                >
                                                    {label}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {overflow > 0 && (
                                        <div
                                            style={{
                                                fontSize: '0.68rem',
                                                color: 'var(--color-link, #2563eb)',
                                                fontWeight: 600,
                                                marginTop: 3,
                                                paddingLeft: 4,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            +{overflow} mais…
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            <FloatingDatePicker
                open={showPicker}
                onClose={() => setShowPicker(false)}
                selectedDate={monthStart}
                onChange={d => {
                    setAnchorMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                    setShowPicker(false);
                }}
            />
        </div>
    );
}
