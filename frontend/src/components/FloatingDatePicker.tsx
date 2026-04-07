import React from 'react';

type Props = {
    open: boolean;
    onClose: () => void;
    selectedDate: Date;
    onChange: (next: Date) => void;
    initialPosition?: { x: number; y: number };
    minTop?: number;
    minDate?: Date;
};

type View = 'day' | 'month' | 'year';

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const MONTH_LABELS = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];
const YEAR_RANGE = 12;

function startOfMonth(d: Date) {
    const x = new Date(d);
    x.setDate(1);
    x.setHours(0, 0, 0, 0);
    return x;
}
function addMonths(d: Date, n: number) {
    const x = new Date(d);
    x.setMonth(x.getMonth() + n);
    return x;
}
function isSameDay(a: Date, b: Date) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}
function startOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}
function monthIndex(d: Date) {
    return d.getFullYear() * 12 + d.getMonth();
}

export default function FloatingDatePicker({
    open,
    onClose,
    selectedDate,
    onChange,
    initialPosition,
    minTop,
    minDate,
}: Props) {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const [pos, setPos] = React.useState(() => ({
        x: initialPosition?.x ?? 24,
        y: initialPosition?.y ?? 120,
    }));
    const [drag, setDrag] = React.useState<{
        active: boolean;
        startX: number;
        startY: number;
        originX: number;
        originY: number;
    }>({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 });

    const [viewMonth, setViewMonth] = React.useState(() =>
        startOfMonth(selectedDate),
    );
    const [view, setView] = React.useState<View>('day');
    const [yearBase, setYearBase] = React.useState(
        () => Math.floor(selectedDate.getFullYear() / YEAR_RANGE) * YEAR_RANGE,
    );

    React.useEffect(() => {
        if (open) {
            setViewMonth(startOfMonth(selectedDate));
            setView('day');
            setYearBase(
                Math.floor(selectedDate.getFullYear() / YEAR_RANGE) * YEAR_RANGE,
            );
        }
    }, [open, selectedDate]);

    React.useEffect(() => {
        function onMove(e: MouseEvent) {
            if (!drag.active) return;
            setPos({
                x: drag.originX + (e.clientX - drag.startX),
                y: drag.originY + (e.clientY - drag.startY),
            });
        }
        function onUp() {
            setDrag(d => ({ ...d, active: false }));
        }
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [drag.active, drag.startX, drag.startY, drag.originX, drag.originY]);

    if (!open) return null;

    const minDay = minDate ? startOfDay(minDate) : undefined;

    const minTopPx = typeof minTop === 'number' ? minTop : 88;
    const clampedX = Math.min(
        Math.max(pos.x, 8),
        Math.max(8, (window.innerWidth ?? 360) - 280 - 8),
    );
    const clampedY = Math.max(pos.y, minTopPx);

    const dragHandle = (
        <div
            onMouseDown={e =>
                setDrag({
                    active: true,
                    startX: e.clientX,
                    startY: e.clientY,
                    originX: pos.x,
                    originY: pos.y,
                })
            }
            style={{
                cursor: 'move',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f9fafb',
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
            }}
        >
            <button
                type='button'
                onClick={() => {
                    if (view === 'day') {
                        const canPrev =
                            !minDay ||
                            monthIndex(viewMonth) > monthIndex(startOfMonth(minDay));
                        if (canPrev) setViewMonth(addMonths(viewMonth, -1));
                    } else if (view === 'month') {
                        setViewMonth(v => new Date(v.getFullYear() - 1, v.getMonth(), 1));
                    } else {
                        setYearBase(y => y - YEAR_RANGE);
                    }
                }}
                style={{ border: 'none', background: 'transparent', padding: 4, cursor: 'pointer', fontSize: 14 }}
                title='Anterior'
            >
                «
            </button>

            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {view === 'day' && (
                    <>
                        <button
                            type='button'
                            onClick={() => setView('month')}
                            style={{ border: 'none', background: 'transparent', fontWeight: 600, cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}
                            title='Selecionar mês'
                        >
                            {viewMonth.toLocaleDateString('pt-BR', { month: 'long' })}
                        </button>
                        <button
                            type='button'
                            onClick={() => setView('year')}
                            style={{ border: 'none', background: 'transparent', fontWeight: 600, cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}
                            title='Selecionar ano'
                        >
                            {viewMonth.getFullYear()}
                        </button>
                    </>
                )}
                {view === 'month' && (
                    <button
                        type='button'
                        onClick={() => setView('year')}
                        style={{ border: 'none', background: 'transparent', fontWeight: 600, cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}
                        title='Selecionar ano'
                    >
                        {viewMonth.getFullYear()}
                    </button>
                )}
                {view === 'year' && (
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                        {yearBase} – {yearBase + YEAR_RANGE - 1}
                    </span>
                )}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                    type='button'
                    onClick={() => {
                        if (view === 'day') setViewMonth(addMonths(viewMonth, 1));
                        else if (view === 'month') setViewMonth(v => new Date(v.getFullYear() + 1, v.getMonth(), 1));
                        else setYearBase(y => y + YEAR_RANGE);
                    }}
                    style={{ border: 'none', background: 'transparent', padding: 4, cursor: 'pointer', fontSize: 14 }}
                    title='Próximo'
                >
                    »
                </button>
                <button
                    type='button'
                    onClick={onClose}
                    style={{ border: 'none', background: 'transparent', padding: 4, cursor: 'pointer' }}
                    title='Fechar'
                >
                    ✕
                </button>
            </div>
        </div>
    );

    // ── Year view ──────────────────────────────────────────────────────────
    if (view === 'year') {
        const years = Array.from({ length: YEAR_RANGE }, (_, i) => yearBase + i);
        return (
            <div ref={containerRef} style={containerStyle(clampedX, clampedY, drag.active)}>
                {dragHandle}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, padding: 8 }}>
                    {years.map(y => {
                        const isSelected = y === viewMonth.getFullYear();
                        return (
                            <button
                                key={y}
                                type='button'
                                onClick={() => {
                                    setViewMonth(v => new Date(y, v.getMonth(), 1));
                                    setView('month');
                                }}
                                style={{
                                    padding: '8px 4px',
                                    borderRadius: 6,
                                    border: isSelected ? '2px solid #2563eb' : '1px solid #e5e7eb',
                                    background: '#fff',
                                    color: isSelected ? '#2563eb' : '#111827',
                                    fontWeight: isSelected ? 700 : 500,
                                    cursor: 'pointer',
                                    fontSize: 13,
                                }}
                            >
                                {y}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    // ── Month view ─────────────────────────────────────────────────────────
    if (view === 'month') {
        return (
            <div ref={containerRef} style={containerStyle(clampedX, clampedY, drag.active)}>
                {dragHandle}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, padding: 8 }}>
                    {MONTH_LABELS.map((label, idx) => {
                        const isSelected = idx === viewMonth.getMonth();
                        return (
                            <button
                                key={label}
                                type='button'
                                onClick={() => {
                                    setViewMonth(new Date(viewMonth.getFullYear(), idx, 1));
                                    setView('day');
                                }}
                                style={{
                                    padding: '10px 4px',
                                    borderRadius: 6,
                                    border: isSelected ? '2px solid #2563eb' : '1px solid #e5e7eb',
                                    background: '#fff',
                                    color: isSelected ? '#2563eb' : '#111827',
                                    fontWeight: isSelected ? 700 : 500,
                                    cursor: 'pointer',
                                    fontSize: 13,
                                }}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    // ── Day view ───────────────────────────────────────────────────────────
    const first = startOfMonth(viewMonth);
    const month = first.getMonth();
    const offset = (first.getDay() + 6) % 7;
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - offset);
    const days: { date: Date; inMonth: boolean }[] = Array.from(
        { length: 42 },
        (_, i) => {
            const d = new Date(gridStart);
            d.setDate(gridStart.getDate() + i);
            return { date: d, inMonth: d.getMonth() === month };
        },
    );

    const canPrev =
        !minDay || monthIndex(viewMonth) > monthIndex(startOfMonth(minDay));

    return (
        <div ref={containerRef} style={containerStyle(clampedX, clampedY, drag.active)}>
            {dragHandle}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '8px 8px 4px', gap: 4 }}>
                {WEEKDAY_LABELS.map(wd => (
                    <div key={wd} style={{ textAlign: 'center', fontSize: 12, color: '#6b7280' }}>
                        {wd}
                    </div>
                ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 8px 8px', gap: 4 }}>
                {days.map(({ date, inMonth }) => {
                    const selected = isSameDay(date, selectedDate);
                    const disabled = !!minDay && date < minDay;
                    const today = startOfDay(date).getTime() === startOfDay(new Date()).getTime();
                    return (
                        <button
                            key={date.toISOString()}
                            type='button'
                            disabled={disabled}
                            onClick={() => {
                                if (disabled) return;
                                const next = new Date(selectedDate);
                                next.setFullYear(date.getFullYear());
                                next.setMonth(date.getMonth());
                                next.setDate(date.getDate());
                                onChange(next);
                            }}
                            style={{
                                aspectRatio: '1 / 1',
                                borderRadius: 6,
                                border: `${selected ? 2 : 1}px solid ${selected ? '#2563eb' : '#e5e7eb'}`,
                                background: '#fff',
                                color: disabled
                                    ? '#d1d5db'
                                    : selected
                                      ? '#2563eb'
                                      : today
                                        ? 'var(--color-success)'
                                        : inMonth
                                          ? '#111827'
                                          : '#9ca3af',
                                fontWeight: selected || today ? 700 : 500,
                                cursor: disabled ? 'not-allowed' : 'pointer',
                                opacity: disabled ? 0.6 : 1,
                            }}
                            title={date.toLocaleDateString('pt-BR')}
                        >
                            {date.getDate()}
                        </button>
                    );
                })}
            </div>
            {!canPrev && <div style={{ display: 'none' }} aria-hidden />}
        </div>
    );
}

function containerStyle(x: number, y: number, dragging: boolean): React.CSSProperties {
    return {
        position: 'absolute',
        left: x,
        top: y,
        width: 280,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        zIndex: 50,
        userSelect: dragging ? 'none' : 'auto',
    };
}
