import React from 'react';
import { getNow } from '../utils/now';
import FloatingDatePicker from '../components/FloatingDatePicker';
import { FaArrowLeft, FaArrowRight, FaCalendarAlt } from 'react-icons/fa';
import TimeRangeLabel from '../components/shared/TimeRangeLabel';
import AppointmentCard from '../components/shared/AppointmentCard';
import QuickScheduleModal from '../components/QuickScheduleModal';
import PendingActionsModal from '../components/PendingActionsModal';
import AppointmentDetailsModal from '../components/AppointmentDetailsModal';
import type { Appointment } from '../hooks/useAppointments';
import { useAppointmentsRange } from '../hooks/useAppointments';
import type { ClientBasic } from '../types/ClientBasic';
import InlineAppointmentEditor from '../components/InlineAppointmentEditor';

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

type StatusKey = 'scheduled' | 'done' | 'canceled' | 'ongoing';
const STATUS_ORDER: StatusKey[] = ['ongoing', 'scheduled', 'done', 'canceled'];

export default function DesktopAgendaPage() {
    const [showPicker, setShowPicker] = React.useState(false);
    const [pickerPos, setPickerPos] = React.useState<
        { x: number; y: number } | undefined
    >(undefined);
    const openDatePicker = React.useCallback(
        (ev?: React.MouseEvent | React.PointerEvent | React.TouchEvent) => {
            let px = 24;
            let py = 120;
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const native = (ev as any)?.nativeEvent ?? ev;
                if (native) {
                    if (typeof native.clientX === 'number') {
                        px = native.clientX;
                        py = native.clientY;
                    } else if (native.touches && native.touches[0]) {
                        px = native.touches[0].clientX;
                        py = native.touches[0].clientY;
                    }
                }
            } catch {
                /* noop */
            }
            setPickerPos({ x: px, y: py });
            setShowPicker(true);
        },
        [],
    );

    const [selectedDay, setSelectedDay] = React.useState(
        startOfDay(new Date()),
    );
    const [reloadKey, setReloadKey] = React.useState(0);
    const [pendingOpen, setPendingOpen] = React.useState(false);
    const [pendingAppt, setPendingAppt] = React.useState<Appointment | null>(
        null,
    );
    const [detailsOpen, setDetailsOpen] = React.useState(false);
    const [detailsAppt, setDetailsAppt] = React.useState<Appointment | null>(
        null,
    );
    const dayStart = React.useMemo(
        () => startOfDay(selectedDay),
        [selectedDay],
    );
    const dayEnd = React.useMemo(() => addDays(dayStart, 1), [dayStart]);
    const { items, loading, error } = useAppointmentsRange(
        dayStart,
        dayEnd,
        undefined,
        reloadKey,
    );
    const [statusFilter, setStatusFilter] = React.useState<
        'all' | 'active' | 'past' | 'done' | 'canceled' | 'ongoing'
    >('active');

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
        client?: ClientLike | number;
    };
    const [now, setNow] = React.useState<Date>(getNow());
    React.useEffect(() => {
        // Tick only when viewing today
        const isToday =
            startOfDay(getNow()).getTime() ===
            startOfDay(selectedDay).getTime();
        if (!isToday) return;
        const id = setInterval(() => setNow(getNow()), 5000);
        return () => clearInterval(id);
    }, [selectedDay]);

    const enriched: EnrichedAppt[] = React.useMemo(() => {
        const refNow = now;
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
                ...(client ? { client } : {}),
            } as EnrichedAppt;
        });
    }, [items, now]);

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

    // QuickSchedule: abrir em modo edição ao tocar no cartão
    const [qsOpen, setQsOpen] = React.useState(false);
    const [qsClient, setQsClient] = React.useState<ClientBasic | null>(null);
    const [qsEdit, setQsEdit] = React.useState<Appointment | null>(null);
    const [inlineEditId, setInlineEditId] = React.useState<number | null>(null);

    function splitName(full?: string): { first: string; last: string } {
        if (!full) return { first: 'Cliente', last: '' };
        const parts = full.trim().split(/\s+/);
        if (parts.length === 1) return { first: parts[0], last: '' };
        const last = parts.pop() || '';
        return { first: parts.join(' '), last };
    }

    function isClientLike(x: unknown): x is { id: number; name?: string } {
        return (
            typeof x === 'object' &&
            x !== null &&
            'id' in (x as Record<string, unknown>) &&
            typeof (x as { id: unknown }).id === 'number'
        );
    }

    function makeClientBasic(a: EnrichedAppt): ClientBasic {
        const c: ClientLike | number | undefined = a.client as
            | ClientLike
            | number
            | undefined;
        const displayName = (isClientLike(c) && c.name) || a.client_name || '';
        const { first, last } = splitName(displayName);
        let clientId = 0;
        if (typeof c === 'number') clientId = c;
        else if (isClientLike(c)) clientId = c.id;
        return {
            id: clientId,
            first_name: first,
            last_name: last,
            phone: '',
            email: '',
            next_appointment_id: a.id,
            next_appointment_status: a.status,
            next_appointment_start_at: a.start_at,
            next_appointment_end_at: a.end_at,
            next_appointment_title: a.title,
            next_appointment_visit_type: a.visit_type,
            next_appointment_notes: a.notes || null,
        } as ClientBasic;
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                height: '100%',
                padding: '12px 16px',
            }}
        >
            {/* Header */}
            <div
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    background: 'var(--color-bg)',
                    borderBottom: '1px solid var(--color-border)',
                    paddingTop: 'env(safe-area-inset-top, 0px)',
                }}
            >
                <div style={{ display: 'grid', gap: 12, paddingBottom: 8 }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            minWidth: 0,
                        }}
                    >
                        <div
                            style={{
                                fontWeight: 800,
                                fontSize: 'var(--font-title-lg)',
                                color: 'var(--color-heading)',
                            }}
                        >
                            Agenda — Desktop
                        </div>
                    </div>
                </div>
            </div>

            {/* Linha 2: Hoje + calendário à esquerda, navegação central */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button
                        onClick={() => setSelectedDay(startOfDay(new Date()))}
                        style={{
                            fontSize: 'var(--font-body)',
                            fontWeight: 700,
                            padding: '4px 10px',
                            border: '1px solid var(--color-success-darker)',
                            background: 'var(--color-success-dark)',
                            borderRadius: 6,
                            cursor: 'pointer',
                            color: 'white',
                        }}
                        aria-label='Ir para hoje'
                    >
                        Hoje
                    </button>
                    <button
                        type='button'
                        onClick={openDatePicker}
                        title='Abrir calendário'
                        aria-label='Abrir calendário'
                        style={{
                            width: 32,
                            height: 32,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--color-success-dark)',
                            fontSize: 'var(--icon-size-lg)',
                            userSelect: 'none',
                        }}
                    >
                        <FaCalendarAlt />
                    </button>
                </div>
                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 12,
                    }}
                >
                    <button
                        onClick={() => setSelectedDay(addDays(selectedDay, -1))}
                        title='Dia anterior'
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--color-success-dark)',
                            width: 36,
                            height: 36,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 'var(--icon-size-lg)',
                        }}
                        aria-label='Dia anterior'
                    >
                        <FaArrowLeft />
                    </button>
                    <button
                        type='button'
                        onClick={openDatePicker}
                        title='Selecionar data'
                        aria-label='Selecionar data'
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--color-success-dark)',
                            fontWeight: 800,
                            fontSize: 'var(--font-title-md)',
                            whiteSpace: 'nowrap',
                            userSelect: 'none',
                        }}
                    >
                        {selectedDay.toLocaleDateString('pt-BR', {
                            weekday: 'long',
                            day: '2-digit',
                            month: '2-digit',
                        })}
                    </button>
                    <button
                        onClick={() => setSelectedDay(addDays(selectedDay, 1))}
                        title='Próximo dia'
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--color-success-dark)',
                            width: 36,
                            height: 36,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 'var(--icon-size-lg)',
                        }}
                        aria-label='Próximo dia'
                    >
                        <FaArrowRight />
                    </button>
                </div>
            </div>

            {/* Filtro de status (default: Ativos) */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'wrap',
                }}
            >
                <label htmlFor='status-filter' style={{ fontWeight: 600 }}>
                    Status:
                </label>
                <select
                    id='status-filter'
                    value={statusFilter}
                    onChange={e =>
                        setStatusFilter(e.target.value as typeof statusFilter)
                    }
                    style={{
                        fontSize: 'var(--font-body)',
                        padding: '6px 8px',
                        background: 'var(--color-pending-bg)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 6,
                        color: 'var(--color-text)',
                        fontWeight: 500,
                    }}
                    aria-label='Filtro de status'
                >
                    <option value='all'>Todos</option>
                    <option value='active'>Ativos</option>
                    <option value='ongoing'>Em andamento</option>
                    <option value='past'>Pendentes</option>
                    <option value='done'>Concluídos</option>
                    <option value='canceled'>Cancelados</option>
                </select>
            </div>

            {/* Lista do dia */}
            <div
                style={{
                    overflow: 'auto',
                    paddingTop: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                }}
            >
                {error && (
                    <div style={{ color: 'var(--color-danger)' }}>
                        Erro ao carregar: {String(error)}
                    </div>
                )}
                {loading && <div>Carregando…</div>}
                {!loading && sorted.length === 0 && (
                    <div>Nenhum agendamento para este dia.</div>
                )}
                {!loading &&
                    sorted.map(a => {
                        const isActive = a.status === 'scheduled' && !a._isPast;
                        const isPending = a.status === 'scheduled' && a._isPast;
                        const isEditing = inlineEditId === a.id;
                        return (
                            <div
                                key={a.id}
                                data-appt-id={a.id}
                                style={{
                                    display: 'flex',
                                    gap: 10,
                                    alignItems: 'flex-start',
                                }}
                            >
                                <TimeRangeLabel
                                    start={a.start_at}
                                    end={a.end_at}
                                    size='md'
                                />
                                <div
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        width: '100%',
                                        maxWidth: 'min(1024px, 96%)',
                                    }}
                                >
                                    {isEditing ? (
                                        <InlineAppointmentEditor
                                            appt={a}
                                            onCancel={() =>
                                                setInlineEditId(null)
                                            }
                                            onSaved={() => {
                                                setInlineEditId(null);
                                                setReloadKey(x => x + 1);
                                            }}
                                        />
                                    ) : (
                                        <div style={{ position: 'relative' }}>
                                            <AppointmentCard
                                                appt={a}
                                                style={{ padding: '6px 8px' }}
                                                showTime={false}
                                                showEditAction={false}
                                                onClick={
                                                    isActive
                                                        ? () => {
                                                              const client =
                                                                  makeClientBasic(
                                                                      a,
                                                                  );
                                                              setQsClient(
                                                                  client,
                                                              );
                                                              setQsEdit(a);
                                                              setQsOpen(true);
                                                          }
                                                        : isPending
                                                        ? () => {
                                                              setPendingAppt(a);
                                                              setPendingOpen(
                                                                  true,
                                                              );
                                                          }
                                                        : undefined
                                                }
                                                onDetails={
                                                    a.status === 'done'
                                                        ? appt => {
                                                              setDetailsAppt(
                                                                  appt as Appointment,
                                                              );
                                                              setDetailsOpen(
                                                                  true,
                                                              );
                                                          }
                                                        : undefined
                                                }
                                            />
                                            {isActive && (
                                                <button
                                                    type='button'
                                                    aria-label='Editar inline'
                                                    title='Editar inline'
                                                    onClick={() =>
                                                        setInlineEditId(a.id)
                                                    }
                                                    style={{
                                                        position: 'absolute',
                                                        top: 6,
                                                        right: 6,
                                                        padding: '4px 8px',
                                                        borderRadius: 6,
                                                        border: '1px solid var(--color-border)',
                                                        background: '#fff',
                                                        fontSize: 12,
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    Editar
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
            </div>

            <FloatingDatePicker
                open={showPicker}
                onClose={() => setShowPicker(false)}
                selectedDate={selectedDay}
                onChange={d => {
                    setSelectedDay(startOfDay(d));
                    setShowPicker(false);
                }}
                initialPosition={pickerPos}
            />

            {qsOpen && qsClient && (
                <QuickScheduleModal
                    open={qsOpen}
                    onClose={() => setQsOpen(false)}
                    client={qsClient}
                    editAppointment={qsEdit}
                    afterPersist={() => {
                        setQsOpen(false);
                        setReloadKey(x => x + 1);
                    }}
                />
            )}
            {pendingOpen && pendingAppt && (
                <PendingActionsModal
                    open={pendingOpen}
                    onClose={() => {
                        setPendingOpen(false);
                        setPendingAppt(null);
                        setReloadKey(x => x + 1);
                    }}
                    appt={pendingAppt}
                />
            )}
            {detailsOpen && detailsAppt && (
                <AppointmentDetailsModal
                    open={detailsOpen}
                    onClose={() => {
                        setDetailsOpen(false);
                        setDetailsAppt(null);
                    }}
                    appt={detailsAppt}
                />
            )}
        </div>
    );
}
