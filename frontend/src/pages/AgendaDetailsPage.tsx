import React, { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    useAppointmentsRange,
    type Appointment,
} from '../hooks/useAppointments';
import { API_BASE } from '../config/api';
import { isTokenExpired } from '../utils/jwt';
import '../styles/palette.css';

function toISODate(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

function parseDateParam(s?: string | null) {
    if (!s) return new Date();
    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(s);
    if (!m) return new Date();
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

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
function startOfWeekMonday(d: Date) {
    const x = startOfDay(d);
    const day = x.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    x.setDate(x.getDate() + diff);
    return x;
}
function endOfWeekMonday(d: Date) {
    const s = startOfWeekMonday(d);
    const e = new Date(s);
    e.setDate(e.getDate() + 7);
    return e;
}

function formatTime(dt: Date) {
    return dt.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    });
}
function formatStatus(status: 'scheduled' | 'done' | 'canceled') {
    switch (status) {
        case 'scheduled':
            return 'Agendado';
        case 'done':
            return 'Realizado';
        case 'canceled':
            return 'Cancelado';
        default:
            return status;
    }
}

const PT_WEEKDAYS_LONG = [
    'domingo',
    'segunda-feira',
    'terça-feira',
    'quarta-feira',
    'quinta-feira',
    'sexta-feira',
    'sábado',
];

type StatusFilter = 'all' | 'scheduled' | 'done' | 'canceled';

export default function AgendaDetailsPage() {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const [date, setDate] = useState<Date>(() =>
        parseDateParam(params.get('date')),
    );
    const [mode, setMode] = useState<'day' | 'week'>(
        () => (params.get('mode') as 'day' | 'week') || 'week',
    );
    const { start, end } = useMemo(() => {
        if (mode === 'week') {
            return {
                start: startOfWeekMonday(date),
                end: endOfWeekMonday(date),
            };
        }
        return { start: startOfDay(date), end: endOfDay(date) };
    }, [date, mode]);

    const { items, loading } = useAppointmentsRange(start, end);
    const [dayFilters, setDayFilters] = useState<Record<string, StatusFilter>>(
        () => {
            try {
                const raw = localStorage.getItem('agenda.details.filters');
                return raw
                    ? (JSON.parse(raw) as Record<string, StatusFilter>)
                    : {};
            } catch {
                return {};
            }
        },
    );

    const weekDays = useMemo(() => {
        if (mode !== 'week') return [] as Date[];
        const s = startOfWeekMonday(date);
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(s);
            d.setDate(s.getDate() + i);
            return d;
        });
    }, [date, mode]);

    const itemsByDay = useMemo(() => {
        const map: Record<string, Appointment[]> = {};
        items.forEach(a => {
            const d = new Date(a.start_at);
            const key = toISODate(d);
            if (!map[key]) map[key] = [];
            map[key].push(a);
        });
        Object.values(map).forEach(list =>
            list.sort(
                (a, b) =>
                    new Date(a.start_at).getTime() -
                    new Date(b.start_at).getTime(),
            ),
        );
        if (mode === 'day') {
            const k = toISODate(date);
            return { [k]: map[k] || [] } as Record<string, Appointment[]>;
        }
        weekDays.forEach(d => {
            const k = toISODate(d);
            if (!map[k]) map[k] = [];
        });
        return map;
    }, [items, mode, date, weekDays]);

    // Long-press and modal
    const pressTimerRef = useRef<number | null>(null);
    const longPressTriggeredRef = useRef<boolean>(false);
    const currentPressApptRef = useRef<Appointment | null>(null);
    const [actionModal, setActionModal] = useState<{
        open: boolean;
        appt?: Appointment;
    }>({ open: false });
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);
    const [localStatuses, setLocalStatuses] = useState<
        Record<number, Appointment['status']>
    >({});
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [pressedKey, setPressedKey] = useState<number | null>(null);
    const [pressedDayKey, setPressedDayKey] = useState<string | null>(null);
    const modalBoxRef = useRef<HTMLDivElement | null>(null);
    const firstBtnRef = useRef<HTMLButtonElement | null>(null);
    const prevFocusRef = useRef<HTMLElement | null>(null);
    const [modalAnim, setModalAnim] = useState(false);
    const overlayTouchStartY = useRef<number | null>(null);

    function openModal(appt: Appointment) {
        setActionModal({ open: true, appt });
        setSelectedId(appt.id);
        if (typeof navigator !== 'undefined') {
            const vib = (
                navigator as Navigator & {
                    vibrate?: (pattern: number | number[]) => boolean;
                }
            ).vibrate;
            if (typeof vib === 'function') vib(10);
        }
        // Clear any text selection that might have been triggered by long-press
        try {
            const sel =
                typeof window !== 'undefined' && window.getSelection
                    ? window.getSelection()
                    : null;
            if (sel && typeof sel.removeAllRanges === 'function')
                sel.removeAllRanges();
        } catch (e) {
            void e;
        }
        // Also blur the active element to avoid focus outlines
        try {
            const el = document.activeElement as HTMLElement | null;
            if (el && typeof el.blur === 'function') el.blur();
        } catch (e) {
            void e;
        }
    }
    function closeModal() {
        setActionModal({ open: false });
    }
    // Persist filters
    React.useEffect(() => {
        try {
            localStorage.setItem(
                'agenda.details.filters',
                JSON.stringify(dayFilters),
            );
        } catch (e) {
            void e;
        }
    }, [dayFilters]);

    // Modal lifecycle: animation, ESC to close, focus handling and focus trap
    React.useEffect(() => {
        if (!actionModal.open) return;
        prevFocusRef.current = (document.activeElement as HTMLElement) || null;
        setModalAnim(false);
        const raf = requestAnimationFrame(() => setModalAnim(true));
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeModal();
                return;
            }
            if (e.key === 'Tab' && modalBoxRef.current) {
                const focusables = Array.from(
                    modalBoxRef.current.querySelectorAll<HTMLElement>(
                        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
                    ),
                ).filter(el => !el.hasAttribute('disabled'));
                if (focusables.length === 0) return;
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                const active = document.activeElement as HTMLElement | null;
                if (e.shiftKey) {
                    if (
                        active === first ||
                        !modalBoxRef.current.contains(active)
                    ) {
                        e.preventDefault();
                        last.focus();
                    }
                } else {
                    if (active === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            }
        };
        window.addEventListener('keydown', onKey);
        const t = setTimeout(() => firstBtnRef.current?.focus(), 0);
        return () => {
            window.removeEventListener('keydown', onKey);
            cancelAnimationFrame(raf);
            clearTimeout(t);
            prevFocusRef.current?.focus?.();
        };
    }, [actionModal.open]);
    // removed legacy onPressStart (mouse/touch-specific handlers below)
    function onPressStartTouch(e: React.TouchEvent, appt: Appointment) {
        const t = e.touches[0];
        touchStartRef.current = { x: t.clientX, y: t.clientY };
        setPressedKey(appt.id);
        currentPressApptRef.current = appt;
        longPressTriggeredRef.current = false;
        setSelectedId(appt.id);
        if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
        pressTimerRef.current = window.setTimeout(() => {
            longPressTriggeredRef.current = true;
            openModal(appt);
        }, 550);
    }
    function onPressStartMouse(appt: Appointment) {
        setPressedKey(appt.id);
        currentPressApptRef.current = appt;
        longPressTriggeredRef.current = false;
        setSelectedId(appt.id);
        if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
        pressTimerRef.current = window.setTimeout(() => {
            longPressTriggeredRef.current = true;
            openModal(appt);
        }, 550);
    }
    function onPressEnd() {
        if (pressTimerRef.current) {
            window.clearTimeout(pressTimerRef.current);
            pressTimerRef.current = null;
        }
        touchStartRef.current = null;
        currentPressApptRef.current = null;
        longPressTriggeredRef.current = false;
        setPressedKey(null);
        // selection is immediate on press start; do not toggle on release
    }
    function onTouchMoveCheck(e: React.TouchEvent) {
        if (!touchStartRef.current) return;
        const t = e.touches[0];
        const dx = Math.abs(t.clientX - touchStartRef.current.x);
        const dy = Math.abs(t.clientY - touchStartRef.current.y);
        if (dx > 10 || dy > 10) {
            onPressEnd();
        }
    }
    function onKeyOpenModal(e: React.KeyboardEvent, appt: Appointment) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openModal(appt);
        }
    }
    async function cancelAppointment(appt?: Appointment) {
        if (!appt) return;
        const token = localStorage.getItem('accessToken');
        if (isTokenExpired(token)) {
            closeModal();
            return;
        }
        try {
            await fetch(`${API_BASE}/agenda/appointments/${appt.id}/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ status: 'canceled' }),
            });
            setLocalStatuses(prev => ({ ...prev, [appt.id]: 'canceled' }));
        } catch {
            // silent
        } finally {
            closeModal();
        }
    }
    function goToEdit(appt?: Appointment) {
        if (!appt) return;
        const day = toISODate(new Date(appt.start_at));
        closeModal();
        navigate(`/agenda?client=${appt.client}&date=${day}`);
    }

    return (
        <div
            style={{
                padding: '1rem',
                background: '#f8fafc',
                minHeight: '100vh',
            }}
        >
            <div
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 5,
                    background: '#f8fafc',
                    paddingBottom: 8,
                    marginBottom: 8,
                    borderBottom: '1px solid #e5e7eb',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                    }}
                >
                    <h3
                        style={{
                            margin: 0,
                            fontWeight: 800,
                            fontSize: 22,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}
                    >
                        <span aria-hidden='true'>📅</span>
                        <span>Agenda - Detalhes</span>
                    </h3>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}
                    >
                        <button
                            onClick={() => navigate('/agenda/settings')}
                            aria-label='Configurações'
                            title='Configurações da Agenda'
                            style={{
                                padding: '6px 10px',
                                borderRadius: 8,
                                border: '1px solid #e5e7eb',
                                background: '#ffffff',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                            }}
                        >
                            ⚙️
                        </button>
                        <button
                            onClick={() => navigate(-1)}
                            aria-label='Retornar'
                            style={{
                                padding: '6px 10px',
                                borderRadius: 8,
                                border: '1px solid #e5e7eb',
                                background: '#ffffff',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                            }}
                        >
                            ✅ Ok
                        </button>
                    </div>
                </div>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 8,
                    }}
                >
                    <input
                        type='date'
                        value={toISODate(date)}
                        onChange={e => {
                            const val = e.target.value;
                            const d = parseDateParam(val);
                            setDate(d);
                            params.set('date', toISODate(d));
                            setParams(params, { replace: true });
                        }}
                        style={{ padding: 6 }}
                    />
                    <select
                        value={mode}
                        onChange={e => {
                            const v = e.target.value as 'day' | 'week';
                            setMode(v);
                            params.set('mode', v);
                            setParams(params, { replace: true });
                        }}
                    >
                        <option value='day'>Dia</option>
                        <option value='week'>Semana</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div>Carregando…</div>
            ) : mode === 'week' ? (
                <div style={{ display: 'grid', gap: 10 }}>
                    {weekDays.map(d => {
                        const key = toISODate(d);
                        const list = itemsByDay[key] || [];
                        const filter = dayFilters[key] ?? 'all';
                        const filtered =
                            filter === 'all'
                                ? list
                                : list.filter(a => a.status === filter);
                        const weekday = d.getDay();
                        return (
                            <div
                                key={key}
                                style={{
                                    border:
                                        pressedDayKey === key
                                            ? '1px solid #cbd5e1'
                                            : '1px solid #e5e7eb',
                                    borderRadius: 10,
                                    padding: 12,
                                    background:
                                        pressedDayKey === key
                                            ? '#f9fafb'
                                            : '#ffffff',
                                    boxShadow:
                                        pressedDayKey === key
                                            ? '0 2px 4px rgba(0,0,0,0.06)'
                                            : '0 1px 2px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.03)',
                                    transition:
                                        'background 120ms ease, box-shadow 120ms ease, border-color 120ms ease',
                                }}
                                onTouchStart={() => setPressedDayKey(key)}
                                onTouchEnd={() => setPressedDayKey(null)}
                                onMouseDown={() => setPressedDayKey(key)}
                                onMouseUp={() => setPressedDayKey(null)}
                                onMouseLeave={() => setPressedDayKey(null)}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'baseline',
                                        justifyContent: 'space-between',
                                        gap: 8,
                                    }}
                                >
                                    <div>
                                        <div
                                            style={{
                                                fontSize: 16,
                                                color: '#6b7280',
                                                fontWeight: 600,
                                            }}
                                        >
                                            {PT_WEEKDAYS_LONG[weekday]}
                                        </div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                flexWrap: 'wrap',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontWeight: 700,
                                                    fontSize: 18,
                                                }}
                                            >
                                                {String(d.getDate()).padStart(
                                                    2,
                                                    '0',
                                                )}
                                                /
                                                {String(
                                                    d.getMonth() + 1,
                                                ).padStart(2, '0')}
                                                /{d.getFullYear()}
                                            </div>
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'flex-end',
                                            gap: 6,
                                        }}
                                    >
                                        <select
                                            value={filter}
                                            onChange={e =>
                                                setDayFilters(prev => ({
                                                    ...prev,
                                                    [key]: e.target
                                                        .value as StatusFilter,
                                                }))
                                            }
                                            style={{
                                                fontSize: 14,
                                                padding: '4px 6px',
                                            }}
                                            aria-label={`Filtro do dia ${String(
                                                d.getDate(),
                                            ).padStart(2, '0')}/${String(
                                                d.getMonth() + 1,
                                            ).padStart(
                                                2,
                                                '0',
                                            )}/${d.getFullYear()}`}
                                        >
                                            <option value='all'>Todos</option>
                                            <option value='scheduled'>
                                                Agendado
                                            </option>
                                            <option value='done'>
                                                Realizado
                                            </option>
                                            <option value='canceled'>
                                                Cancelado
                                            </option>
                                        </select>
                                        <div
                                            style={{
                                                fontSize: 14,
                                                fontWeight: 700,
                                                color: '#374151',
                                                whiteSpace: 'nowrap',
                                            }}
                                            aria-label={`Compromissos: ${filtered.length}`}
                                        >
                                            <span style={{ fontWeight: 700 }}>
                                                {filtered.length}
                                            </span>{' '}
                                            {filtered.length === 1
                                                ? 'compromisso'
                                                : 'compromissos'}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ marginTop: 8 }}>
                                    {filtered.length ? (
                                        <ul
                                            style={{
                                                listStyle: 'none',
                                                padding: 0,
                                                margin: 0,
                                                display: 'grid',
                                                gap: 8,
                                            }}
                                        >
                                            {filtered.map(a => {
                                                const start = new Date(
                                                    a.start_at,
                                                );
                                                const end = new Date(a.end_at);
                                                const currentStatus =
                                                    localStatuses[a.id] ??
                                                    a.status;
                                                const statusText =
                                                    formatStatus(currentStatus);
                                                const statusColor =
                                                    currentStatus === 'canceled'
                                                        ? '#b91c1c'
                                                        : currentStatus ===
                                                          'done'
                                                        ? '#065f46'
                                                        : '#059669';
                                                const statusBg =
                                                    currentStatus === 'canceled'
                                                        ? '#fef2f2'
                                                        : currentStatus ===
                                                          'done'
                                                        ? '#ecfdf5'
                                                        : '#f0fdf4';
                                                return (
                                                    <li
                                                        key={a.id}
                                                        role='button'
                                                        tabIndex={0}
                                                        onKeyDown={e =>
                                                            onKeyOpenModal(e, a)
                                                        }
                                                        onTouchStart={e =>
                                                            onPressStartTouch(
                                                                e,
                                                                a,
                                                            )
                                                        }
                                                        onTouchEnd={() =>
                                                            onPressEnd()
                                                        }
                                                        onTouchMove={
                                                            onTouchMoveCheck
                                                        }
                                                        onMouseDown={e => {
                                                            if (
                                                                e.button === 0
                                                            ) {
                                                                e.preventDefault();
                                                                onPressStartMouse(
                                                                    a,
                                                                );
                                                            }
                                                        }}
                                                        onMouseUp={() =>
                                                            onPressEnd()
                                                        }
                                                        onMouseLeave={() =>
                                                            onPressEnd()
                                                        }
                                                        onContextMenu={e =>
                                                            e.preventDefault()
                                                        }
                                                        style={{
                                                            padding: '10px 8px',
                                                            border: `${
                                                                pressedKey ===
                                                                    a.id ||
                                                                selectedId ===
                                                                    a.id
                                                                    ? 2
                                                                    : 1
                                                            }px solid ${statusColor}`,
                                                            display: 'grid',
                                                            gap: 2,
                                                            background:
                                                                statusBg,
                                                            borderRadius: 8,
                                                            paddingLeft: 14,
                                                            position:
                                                                'relative',
                                                            overflow: 'hidden',
                                                            userSelect: 'none',
                                                            WebkitUserSelect:
                                                                'none',
                                                            boxShadow:
                                                                '0 1px 2px rgba(0,0,0,0.03)',
                                                        }}
                                                    >
                                                        <div
                                                            aria-hidden='true'
                                                            style={{
                                                                position:
                                                                    'absolute',
                                                                left: 0,
                                                                top: 0,
                                                                bottom: 0,
                                                                width: 4,
                                                                background:
                                                                    statusColor,
                                                            }}
                                                        />
                                                        <div
                                                            style={{
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            {formatTime(start)}{' '}
                                                            a {formatTime(end)}{' '}
                                                            - {a.title}
                                                        </div>
                                                        <div
                                                            style={{
                                                                color: '#111827',
                                                            }}
                                                        >
                                                            {a.client_name ||
                                                                '—'}
                                                        </div>
                                                        <div
                                                            style={{
                                                                fontSize: 12,
                                                                color: statusColor,
                                                            }}
                                                        >
                                                            {statusText}
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    ) : (
                                        <div
                                            style={{
                                                color: '#6b7280',
                                                fontSize: 13,
                                            }}
                                        >
                                            Nenhum agendamento.
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div>
                    {(() => {
                        const k = toISODate(date);
                        const list = itemsByDay[k] || [];
                        return list.length ? (
                            <ul
                                style={{
                                    listStyle: 'none',
                                    padding: 0,
                                    margin: 0,
                                    display: 'grid',
                                    gap: 8,
                                }}
                            >
                                {list.map(a => {
                                    const start = new Date(a.start_at);
                                    const end = new Date(a.end_at);
                                    const currentStatus =
                                        localStatuses[a.id] ?? a.status;
                                    const statusText =
                                        formatStatus(currentStatus);
                                    const statusColor =
                                        currentStatus === 'canceled'
                                            ? '#b91c1c'
                                            : currentStatus === 'done'
                                            ? '#065f46'
                                            : '#059669';
                                    const statusBg =
                                        currentStatus === 'canceled'
                                            ? '#fef2f2'
                                            : currentStatus === 'done'
                                            ? '#ecfdf5'
                                            : '#f0fdf4';
                                    return (
                                        <li
                                            key={a.id}
                                            role='button'
                                            tabIndex={0}
                                            onKeyDown={e =>
                                                onKeyOpenModal(e, a)
                                            }
                                            onTouchStart={e =>
                                                onPressStartTouch(e, a)
                                            }
                                            onTouchEnd={() => onPressEnd()}
                                            onTouchMove={onTouchMoveCheck}
                                            onMouseDown={e => {
                                                if (e.button === 0) {
                                                    e.preventDefault();
                                                    onPressStartMouse(a);
                                                }
                                            }}
                                            onMouseUp={() => onPressEnd()}
                                            onMouseLeave={() => onPressEnd()}
                                            onContextMenu={e =>
                                                e.preventDefault()
                                            }
                                            style={{
                                                padding: '10px 8px',
                                                border: `${
                                                    pressedKey === a.id ||
                                                    selectedId === a.id
                                                        ? 2
                                                        : 1
                                                }px solid ${statusColor}`,
                                                display: 'grid',
                                                gap: 2,
                                                background: statusBg,
                                                borderRadius: 8,
                                                paddingLeft: 14,
                                                position: 'relative',
                                                overflow: 'hidden',
                                                userSelect: 'none',
                                                WebkitUserSelect: 'none',
                                                boxShadow:
                                                    '0 1px 2px rgba(0,0,0,0.03)',
                                            }}
                                        >
                                            <div
                                                aria-hidden='true'
                                                style={{
                                                    position: 'absolute',
                                                    left: 0,
                                                    top: 0,
                                                    bottom: 0,
                                                    width: 4,
                                                    background: statusColor,
                                                }}
                                            />
                                            <div style={{ fontWeight: 600 }}>
                                                {formatTime(start)} a{' '}
                                                {formatTime(end)} - {a.title}
                                            </div>
                                            <div style={{ color: '#111827' }}>
                                                {a.client_name || '—'}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 12,
                                                    color: statusColor,
                                                }}
                                            >
                                                {statusText}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <div>Nenhum agendamento.</div>
                        );
                    })()}
                </div>
            )}

            {actionModal.open && (
                <div
                    role='dialog'
                    aria-modal='true'
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 16,
                        zIndex: 50,
                    }}
                    onClick={closeModal}
                    onTouchStart={e => {
                        overlayTouchStartY.current =
                            e.touches[0]?.clientY ?? null;
                    }}
                    onTouchMove={e => {
                        if (overlayTouchStartY.current == null) return;
                        const dy =
                            e.touches[0].clientY - overlayTouchStartY.current;
                        if (dy > 40) {
                            closeModal();
                            overlayTouchStartY.current = null;
                        }
                    }}
                >
                    <div
                        style={{
                            background: '#fff',
                            borderRadius: 12,
                            width: '100%',
                            maxWidth: 360,
                            boxShadow: '0 10px 20px rgba(0,0,0,0.15)',
                            overflow: 'hidden',
                            opacity: modalAnim ? 1 : 0,
                            transform: modalAnim
                                ? 'translateY(0) scale(1)'
                                : 'translateY(10px) scale(0.98)',
                            transition:
                                'opacity 140ms ease, transform 140ms ease',
                        }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                        <div
                            style={{
                                padding: 16,
                                borderBottom: '1px solid #e5e7eb',
                            }}
                        >
                            <div style={{ fontWeight: 700, marginBottom: 2 }}>
                                O que deseja fazer com este compromisso?
                            </div>
                        </div>
                        <div style={{ display: 'grid' }}>
                            <button
                                onClick={() => goToEdit(actionModal.appt)}
                                style={{
                                    padding: 14,
                                    textAlign: 'left',
                                    background: 'white',
                                    border: 'none',
                                    borderBottom: '1px solid #e5e7eb',
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 16,
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                    }}
                                >
                                    <span aria-hidden='true'>✏️</span>
                                    <span>Editar</span>
                                </div>
                                <div style={{ fontSize: 13, color: '#6b7280' }}>
                                    (alterar data / hora)
                                </div>
                            </button>
                            <button
                                onClick={() =>
                                    cancelAppointment(actionModal.appt)
                                }
                                style={{
                                    padding: 14,
                                    textAlign: 'left',
                                    background: 'white',
                                    border: 'none',
                                    borderBottom: '1px solid #e5e7eb',
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 16,
                                        fontWeight: 600,
                                        color: '#b91c1c',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                    }}
                                >
                                    <span aria-hidden='true'>❌</span>
                                    <span>Cancelar</span>
                                </div>
                                <div style={{ fontSize: 13, color: '#9ca3af' }}>
                                    (cancelar esta agenda)
                                </div>
                            </button>
                            <button
                                onClick={closeModal}
                                style={{
                                    padding: 14,
                                    textAlign: 'left',
                                    background: 'white',
                                    border: 'none',
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 16,
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                    }}
                                >
                                    <span aria-hidden='true'>✅</span>
                                    <span>Ok</span>
                                </div>
                                <div style={{ fontSize: 13, color: '#6b7280' }}>
                                    (retornar)
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
