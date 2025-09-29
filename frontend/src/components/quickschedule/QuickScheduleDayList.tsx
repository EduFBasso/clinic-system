import React from 'react';
import TimeRangeLabel from '../shared/TimeRangeLabel';
import AppointmentCard from '../shared/AppointmentCard';
import type { Appointment } from '../../hooks/useAppointments';

export type DayFilter = 'todos' | 'ativos' | 'cancelados';

export interface QuickScheduleDayListProps {
    appointments: Appointment[];
    loading: boolean;
    dayFilter: DayFilter;
    onChangeFilter: (f: DayFilter) => void;
    sectionDateTitle: string;
    highlightId: number | null;
    editingHighlightId: number | null;
    currentEditId: number | null;
    listRef?: React.RefObject<HTMLDivElement | null>;
    onUseTime: (a: Appointment) => void;
    onEdit: (a: Appointment) => void;
    onCancel: (a: Appointment) => Promise<void>;
}

export const QuickScheduleDayList: React.FC<QuickScheduleDayListProps> = ({
    appointments,
    loading,
    dayFilter,
    onChangeFilter,
    sectionDateTitle,
    highlightId,
    editingHighlightId,
    currentEditId,
    listRef,
    onUseTime,
    onEdit,
    onCancel,
}) => {
    const filtered = React.useMemo(() => {
        if (dayFilter === 'todos') return appointments;
        if (dayFilter === 'ativos')
            return appointments.filter(a => a.status === 'scheduled');
        if (dayFilter === 'cancelados')
            return appointments.filter(a => a.status === 'canceled');
        return appointments;
    }, [appointments, dayFilter]);

    return (
        <div
            style={{
                marginTop: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                maxHeight: 'calc(100vh - 360px)',
                overflow: 'visible',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                background: 'var(--card-bg)',
            }}
        >
            <div
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: 'var(--color-text)',
                    padding: '10px 14px',
                    background: 'linear-gradient(#ffffff,#f8fafc)',
                    borderBottom: '1px solid var(--color-border)',
                }}
            >
                <strong style={{ fontSize: 18 }}>Compromissos do dia</strong>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                        value={dayFilter}
                        onChange={e =>
                            onChangeFilter(e.target.value as DayFilter)
                        }
                        style={{
                            padding: '8px 12px',
                            fontSize: 15,
                            fontWeight: 600,
                            border: '1px solid var(--color-border)',
                            borderRadius: 6,
                            background: 'var(--color-bg)',
                            cursor: 'pointer',
                        }}
                        title='Filtrar por status'
                    >
                        <option value='todos'>
                            Todos ({appointments.length})
                        </option>
                        <option value='ativos'>
                            Ativos (
                            {
                                appointments.filter(
                                    a => a.status === 'scheduled',
                                ).length
                            }
                            )
                        </option>
                        <option value='cancelados'>
                            Cancelados (
                            {
                                appointments.filter(
                                    a => a.status === 'canceled',
                                ).length
                            }
                            )
                        </option>
                    </select>
                    {loading && (
                        <span style={{ fontSize: 13, color: '#6b7280' }}>
                            carregando…
                        </span>
                    )}
                </div>
            </div>
            <div
                style={{
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    padding: '10px 14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    flex: 1,
                    WebkitOverflowScrolling: 'touch',
                    overscrollBehavior: 'contain',
                    touchAction: 'pan-y',
                    maxHeight: '100%',
                    minHeight: 120,
                    width: '100%',
                    boxSizing: 'border-box',
                }}
                ref={listRef}
            >
                <div
                    style={{
                        fontSize: 13,
                        color: '#6b7280',
                        fontWeight: 700,
                        letterSpacing: 0.2,
                    }}
                >
                    {sectionDateTitle}
                </div>
                {filtered
                    .slice()
                    .sort((a, b) => a.start_at.localeCompare(b.start_at))
                    .map(appt => (
                        <div
                            key={appt.id}
                            style={{
                                display: 'flex',
                                gap: 10,
                                alignItems: 'flex-start',
                            }}
                        >
                            <TimeRangeLabel
                                start={appt.start_at}
                                end={appt.end_at}
                                size='md'
                            />
                            <div
                                style={{
                                    flex: 1,
                                    minWidth: 0,
                                    width: '100%',
                                    maxWidth: 'min(704px, 94%)',
                                }}
                            >
                                <AppointmentCard<Appointment>
                                    appt={appt}
                                    style={{ padding: '6px 8px' }}
                                    showTime={false}
                                    showEditAction={false}
                                    highlight={highlightId === appt.id}
                                    editingActive={
                                        editingHighlightId === appt.id
                                    }
                                    pulse={
                                        editingHighlightId === appt.id &&
                                        currentEditId === appt.id
                                    }
                                    onUseTime={onUseTime}
                                    onEdit={onEdit}
                                    onCancel={onCancel}
                                />
                            </div>
                        </div>
                    ))}
                {!loading && filtered.length === 0 && (
                    <div style={{ color: '#6b7280', fontSize: 13 }}>
                        Nenhum compromisso neste filtro.
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuickScheduleDayList;
