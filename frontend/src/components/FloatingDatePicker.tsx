import React from 'react';

type Props = {
    open: boolean;
    onClose: () => void;
    selectedDate: Date;
    onChange: (next: Date) => void;
    initialPosition?: { x: number; y: number };
};

const weekdayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

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

export default function FloatingDatePicker({
    open,
    onClose,
    selectedDate,
    onChange,
    initialPosition,
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

    React.useEffect(() => {
        if (open) {
            setViewMonth(startOfMonth(selectedDate));
        }
    }, [open, selectedDate]);

    React.useEffect(() => {
        function onMove(e: MouseEvent) {
            if (!drag.active) return;
            const dx = e.clientX - drag.startX;
            const dy = e.clientY - drag.startY;
            setPos({ x: drag.originX + dx, y: drag.originY + dy });
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

    // Build grid (Mon-Sun)
    const first = startOfMonth(viewMonth);
    const month = first.getMonth();
    // JS getDay: 0=Sun..6=Sat; we want Mon=0..Sun=6
    const offset = (first.getDay() + 6) % 7; // 0..6
    const days: { date: Date; inMonth: boolean }[] = [];
    // Start from the Monday of the first week
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    for (let i = 0; i < 42; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        days.push({ date: d, inMonth: d.getMonth() === month });
    }

    return (
        <div
            ref={containerRef}
            style={{
                position: 'absolute',
                left: pos.x,
                top: pos.y,
                width: 280,
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                zIndex: 50,
                userSelect: drag.active ? 'none' : 'auto',
            }}
        >
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
                    onClick={() => setViewMonth(addMonths(viewMonth, -1))}
                    style={{
                        border: 'none',
                        background: 'transparent',
                        padding: 4,
                        cursor: 'pointer',
                    }}
                    title='Mês anterior'
                >
                    «
                </button>
                <div style={{ fontWeight: 600 }}>
                    {viewMonth.toLocaleDateString('pt-BR', {
                        month: 'long',
                        year: 'numeric',
                    })}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                        type='button'
                        onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                        style={{
                            border: 'none',
                            background: 'transparent',
                            padding: 4,
                            cursor: 'pointer',
                        }}
                        title='Próximo mês'
                    >
                        »
                    </button>
                    <button
                        type='button'
                        onClick={onClose}
                        style={{
                            border: 'none',
                            background: 'transparent',
                            padding: 4,
                            cursor: 'pointer',
                        }}
                        title='Fechar'
                    >
                        ✕
                    </button>
                </div>
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    padding: '8px 8px 4px',
                    gap: 4,
                }}
            >
                {weekdayLabels.map(wd => (
                    <div
                        key={wd}
                        style={{
                            textAlign: 'center',
                            fontSize: 12,
                            color: '#6b7280',
                        }}
                    >
                        {wd}
                    </div>
                ))}
            </div>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    padding: '0 8px 8px',
                    gap: 4,
                }}
            >
                {days.map(({ date, inMonth }) => {
                    const selected = isSameDay(date, selectedDate);
                    return (
                        <button
                            key={date.toISOString()}
                            type='button'
                            onClick={() => {
                                // Preserve time from selectedDate
                                const next = new Date(selectedDate);
                                next.setFullYear(date.getFullYear());
                                next.setMonth(date.getMonth());
                                next.setDate(date.getDate());
                                onChange(next);
                                onClose();
                            }}
                            style={{
                                aspectRatio: '1 / 1',
                                borderRadius: 6,
                                border: selected
                                    ? '2px solid #2563eb'
                                    : '1px solid #e5e7eb',
                                background: selected ? '#dbeafe' : '#fff',
                                color: inMonth ? '#111827' : '#9ca3af',
                                cursor: 'pointer',
                            }}
                            title={date.toLocaleDateString('pt-BR')}
                        >
                            {date.getDate()}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
