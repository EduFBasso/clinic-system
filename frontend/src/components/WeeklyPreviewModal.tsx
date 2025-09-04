import React from 'react';
import AppModal from './Modal';

const WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

function getWeekDays(start: Date) {
    const days: Date[] = [];
    const s = new Date(start);
    s.setHours(0, 0, 0, 0);
    // align start to Monday
    const day = s.getDay(); // 0=Sun ... 6=Sat
    const delta = day === 0 ? -6 : 1 - day; // move back to Monday
    s.setDate(s.getDate() + delta);
    for (let i = 0; i < 7; i++) {
        const d = new Date(s);
        d.setDate(s.getDate() + i);
        days.push(d);
    }
    return days;
}

export default function WeeklyPreviewModal({
    open,
    onClose,
}: {
    open: boolean;
    onClose: () => void;
}) {
    const days = React.useMemo(() => getWeekDays(new Date()), []);

    const headerDate = new Date();
    const header = headerDate.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    const green = { fg: '#065f46', bg: '#ecfdf5', bar: '#10b981' };

    return (
        <AppModal open={open} onClose={onClose} fullScreen disableBackdropClose>
            <div
                style={{
                    display: 'grid',
                    gridTemplateRows: 'auto auto auto 1fr',
                    gap: 12,
                    height: '100%',
                }}
            >
                <div
                    style={{ fontWeight: 800, fontSize: 18, color: '#111827' }}
                >
                    Dia
                </div>
                <div style={{ color: '#374151', fontWeight: 700 }}>
                    {header}
                </div>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(7, 1fr)',
                        gap: 6,
                    }}
                >
                    {days.map((d, idx) => (
                        <div
                            key={idx}
                            style={{
                                textAlign: 'center',
                                fontWeight: 700,
                                color: '#6b7280',
                            }}
                        >
                            {WEEKDAYS[idx]}
                        </div>
                    ))}
                </div>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(7, 1fr)',
                        gap: 8,
                        overflowY: 'auto',
                    }}
                >
                    {days.map((d, idx) => (
                        <div key={idx} style={{ display: 'grid', gap: 8 }}>
                            {Array.from({ length: 7 }).map((_, i) => (
                                <div key={i}>
                                    <div
                                        style={{
                                            background: green.bg,
                                            color: green.fg,
                                            border: `1px solid ${green.bg}`,
                                            borderLeft: `6px solid ${green.bar}`,
                                            borderRadius: 10,
                                            padding: '10px 12px',
                                            fontWeight: 700,
                                        }}
                                    >
                                        <div>08:00 - 09:00</div>
                                        <div
                                            style={{
                                                fontWeight: 600,
                                                color: '#374151',
                                            }}
                                        >
                                            Nome Exemplo
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </AppModal>
    );
}
