import React from 'react';
import AppModal from './Modal';
import type { Appointment } from '../hooks/useAppointments';
import { useAppointments } from '../hooks/useAppointments';
import { FaArrowLeft, FaArrowRight } from 'react-icons/fa';
import TimeRangeLabel from './shared/TimeRangeLabel';
import AppointmentCard from './shared/AppointmentCard';

interface DailyAgendaModalProps {
    open: boolean;
    date: Date;
    onClose: () => void;
    focusAppointmentId?: number;
    onEditAppointment?: (appt: Appointment) => void;
}

function startOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}
function addDays(d: Date, n: number) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
}
// fmtHM removido (uso substituído por TimeRangeLabel)

type StatusKey = 'scheduled' | 'done' | 'canceled' | 'ongoing';
const STATUS_ORDER: StatusKey[] = ['ongoing', 'scheduled', 'done', 'canceled'];

export default function DailyAgendaModal({
    open,
    date,
    onClose,
    focusAppointmentId,
    onEditAppointment,
}: DailyAgendaModalProps) {
    const [selectedDay, setSelectedDay] = React.useState(startOfDay(date));
    React.useEffect(() => {
        if (open) setSelectedDay(startOfDay(date));
    }, [open, date]);
    // Reutiliza hook padrão de agenda por dia (consistência com ScheduleModal)
    const { items, loading, error } = useAppointments(selectedDay);
    const [statusFilter, setStatusFilter] = React.useState<
        'all' | 'active' | 'past' | 'done' | 'canceled' | 'ongoing'
    >('all');
    // Removido refresh manual: modal é somente leitura e se atualizará em reaberturas

    interface ClientLike {
        id: number;
        name: string;
    }
    type RawClientField = ClientLike | number | undefined | null;
    type EnrichedAppt = Appointment & {
        _start: Date;
        _end: Date;
        _isPast: boolean;
        _isOngoing: boolean;
        client?: ClientLike;
    };
    const enriched: EnrichedAppt[] = React.useMemo(() => {
        const refNow = new Date();
        return items.map(a => {
            const _start = new Date(a.start_at);
            const _end = new Date(a.end_at);
            const _isPast = _end < refNow;
            const _isOngoing = _start <= refNow && _end > refNow;
            const rawClient = (a as unknown as { client?: RawClientField })
                .client;
            let client: ClientLike | undefined = undefined;
            if (rawClient && typeof rawClient === 'object') {
                const candidate = rawClient as ClientLike;
                if (
                    typeof candidate.id === 'number' &&
                    typeof candidate.name === 'string'
                )
                    client = candidate;
            }
            return {
                ...a,
                _start,
                _end,
                _isPast,
                _isOngoing,
                client,
            } as EnrichedAppt;
        });
    }, [items]);

    const filtered = enriched.filter(a => {
        switch (statusFilter) {
            case 'all':
                return true;
            case 'active':
                return a.status === 'scheduled' && !a._isPast;
            case 'past':
                return a.status === 'scheduled' && a._isPast;
            case 'done':
                return a.status === 'done';
            case 'canceled':
                return a.status === 'canceled';
            case 'ongoing':
                return a._isOngoing && a.status === 'scheduled';
            default:
                return true;
        }
    });

    const sorted = filtered.slice().sort((a, b) => {
        const t = a._start.getTime() - b._start.getTime();
        if (t !== 0) return t;
        const ai = STATUS_ORDER.indexOf(
            (a._isOngoing ? 'ongoing' : a.status) as StatusKey,
        );
        const bi = STATUS_ORDER.indexOf(
            (b._isOngoing ? 'ongoing' : b.status) as StatusKey,
        );
        return ai - bi;
    });

    React.useEffect(() => {
        if (!open || !focusAppointmentId) return;
        // scroll later after paint
        const id = focusAppointmentId;
        const to = setTimeout(() => {
            const el = document.querySelector(`[data-appt-id="${id}"]`);
            if (el) el.scrollIntoView({ block: 'center' });
        }, 150);
        return () => clearTimeout(to);
    }, [open, focusAppointmentId, sorted]);

    // badgeColor/statusLabel substituídos por <StatusBadge />

    return (
        <AppModal open={open} onClose={onClose}>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    maxHeight: '80vh',
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <button
                        onClick={() => setSelectedDay(addDays(selectedDay, -1))}
                        title='Dia anterior'
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#065f46',
                        }}
                    >
                        <FaArrowLeft />
                    </button>
                    <div
                        style={{
                            fontWeight: 700,
                            color: '#065f46',
                            fontSize: 22,
                        }}
                    >
                        {selectedDay.toLocaleDateString('pt-BR', {
                            weekday: 'long',
                            day: '2-digit',
                            month: '2-digit',
                        })}
                    </div>
                    <button
                        onClick={() => setSelectedDay(addDays(selectedDay, 1))}
                        title='Próximo dia'
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#065f46',
                        }}
                    >
                        <FaArrowRight />
                    </button>
                    <button
                        onClick={() => setSelectedDay(startOfDay(new Date()))}
                        style={{
                            marginLeft: 4,
                            fontSize: 15,
                            fontWeight: 600,
                            padding: '6px 12px',
                            border: '1px solid #065f46',
                            background: 'white',
                            borderRadius: 6,
                            cursor: 'pointer',
                            color: '#065f46',
                        }}
                    >
                        Hoje
                    </button>
                    <div style={{ marginLeft: 'auto' }}>
                        <select
                            value={statusFilter}
                            onChange={e =>
                                setStatusFilter(
                                    e.target.value as typeof statusFilter,
                                )
                            }
                            style={{
                                fontSize: 14,
                                padding: '6px 8px',
                                background: '#f3f4f6',
                                border: '1px solid #d1d5db',
                                borderRadius: 6,
                                color: '#374151',
                                fontWeight: 500,
                            }}
                        >
                            <option value='all'>Todos</option>
                            <option value='active'>Ativos</option>
                            <option value='ongoing'>Em andamento</option>
                            <option value='past'>Vencidos</option>
                            <option value='done'>Concluídos</option>
                            <option value='canceled'>Cancelados</option>
                        </select>
                    </div>
                </div>
                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
                    {loading && (
                        <div style={{ fontSize: 12, color: '#6b7280' }}>
                            Carregando…
                        </div>
                    )}
                    {error && (
                        <div style={{ fontSize: 12, color: '#b91c1c' }}>
                            Erro: {error}
                        </div>
                    )}
                    {!loading && !sorted.length && (
                        <div style={{ fontSize: 12, color: '#6b7280' }}>
                            Nenhum compromisso neste dia.
                        </div>
                    )}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                        }}
                    >
                        {sorted.map(a => (
                            <div
                                key={a.id}
                                data-appt-id={a.id}
                                style={{
                                    display: 'flex',
                                    gap: 8,
                                    alignItems: 'stretch',
                                }}
                            >
                                <TimeRangeLabel
                                    start={a._start}
                                    end={a._end}
                                    size='lg'
                                    style={{
                                        width: 78,
                                        textAlign: 'right',
                                        paddingTop: 4,
                                        color: '#1f2937',
                                    }}
                                />
                                <AppointmentCard
                                    appt={a}
                                    onClick={appt =>
                                        onEditAppointment?.(appt as Appointment)
                                    }
                                    // Destaca visualmente se for o foco inicial
                                    highlight={focusAppointmentId === a.id}
                                    showNotes
                                    style={{ flex: 1 }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
                {/* Footer / stats simples */}
                <div
                    style={{
                        display: 'flex',
                        gap: 20,
                        fontSize: 13,
                        color: '#1f2937',
                        paddingTop: 6,
                        borderTop: '1px solid var(--color-border)',
                        fontWeight: 600,
                        flexWrap: 'wrap',
                    }}
                >
                    <span>
                        Total: <strong>{sorted.length}</strong>
                    </span>
                    <span>
                        Ativos:{' '}
                        <strong>
                            {
                                sorted.filter(
                                    a => a.status === 'scheduled' && !a._isPast,
                                ).length
                            }
                        </strong>
                    </span>
                    <span>
                        Vencidos:{' '}
                        <strong>
                            {
                                sorted.filter(
                                    a => a.status === 'scheduled' && a._isPast,
                                ).length
                            }
                        </strong>
                    </span>
                    <span>
                        Concluídos:{' '}
                        <strong>
                            {sorted.filter(a => a.status === 'done').length}
                        </strong>
                    </span>
                    <span>
                        Cancelados:{' '}
                        <strong>
                            {sorted.filter(a => a.status === 'canceled').length}
                        </strong>
                    </span>
                </div>
            </div>
        </AppModal>
    );
}
