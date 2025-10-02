import React from 'react';
import FloatingDatePicker from '../components/FloatingDatePicker';
import { FaArrowLeft, FaArrowRight, FaCalendarAlt } from 'react-icons/fa';
import ClientCardRow from '../components/shared/ClientCardRow';
import QuickScheduleModal from '../components/QuickScheduleModal';
import PendingActionsModal from '../components/PendingActionsModal';
import AppointmentDetailsModal from '../components/AppointmentDetailsModal';
import type { Appointment } from '../hooks/useAppointments';
import { useAppointmentsRange } from '../hooks/useAppointments';
import type { ClientBasic } from '../types/ClientBasic';
import InlineAppointmentEditor from '../components/InlineAppointmentEditor';
import TimeRangeLabel from '../components/shared/TimeRangeLabel';
import { enrichList } from '../utils/appointments/status';
import { getAppointmentOverride } from '../utils/appointments/overrides';

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

export default function DesktopAgendaPage() {
    // Floating picker state/position
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

    // Effective now reference (stable for one render lifecycle)
    const effectiveNowRef = React.useMemo(() => new Date(), []);

    const enriched: EnrichedAppt[] = React.useMemo(() => {
        const nowRef = effectiveNowRef;
        const base = enrichList(items, nowRef);
        return base.map(a => {
            const rawClient = (a as unknown as { client?: RawClientField })
                .client;
            let client: ClientLike | undefined = undefined;
            if (rawClient && typeof rawClient === 'object') {
                const candidate = rawClient as ClientLike;
                if (
                    typeof candidate.id === 'number' &&
                    typeof candidate.name === 'string'
                ) {
                    client = candidate;
                }
            }
            return { ...a, ...(client ? { client } : {}) } as EnrichedAppt;
        });
    }, [items, effectiveNowRef]);

    const filtered = enriched.filter(a => {
        const ov = getAppointmentOverride(a.id)?.status;
        const status = (ov as StatusKey) ?? a.status;
        switch (statusFilter) {
            case 'all':
                return true;
            case 'active':
                return (status === 'scheduled' || a._isOngoing) && !a._isPast;
            case 'past':
                return status === 'scheduled' && a._isPast;
            case 'done':
                return status === 'done';
            case 'canceled':
                return status === 'canceled';
            case 'ongoing':
                return a._isOngoing || status === 'ongoing';
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
                    zIndex: 20,
                    background: 'var(--color-bg)',
                    borderBottom: '1px solid var(--color-border)',
                    boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
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
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    position: 'sticky',
                    top: 54,
                    zIndex: 15,
                    background: 'var(--color-bg)',
                }}
            >
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
                    position: 'sticky',
                    top: 98,
                    zIndex: 12,
                    background: 'var(--color-bg)',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'wrap',
                    paddingBottom: 6,
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
                        const isEditing = inlineEditId === a.id;
                        return (
                            <div
                                key={a.id}
                                data-appt-id={a.id}
                                style={{
                                    // Keep outer wrapper for spacing; grid managed by row/editor
                                    minWidth: 0,
                                    width: '100%',
                                    maxWidth: 'min(1024px, 96%)',
                                }}
                            >
                                {isEditing ? (
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '56px 1fr',
                                            columnGap: 10,
                                            alignItems: 'flex-start',
                                        }}
                                    >
                                        <TimeRangeLabel
                                            start={a.start_at}
                                            end={a.end_at}
                                            size='md'
                                            order='end-top'
                                        />
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
                                    </div>
                                ) : (
                                    <div style={{ position: 'relative' }}>
                                        <ClientCardRow
                                            appt={a}
                                            timeSize='md'
                                            timeOrder='end-top'
                                            cardContainerStyle={{
                                                minWidth: 0,
                                                width: '100%',
                                            }}
                                            style={{ padding: '6px 8px' }}
                                            showEditAction={false}
                                            onClick={
                                                isActive
                                                    ? () => {
                                                          const client =
                                                              makeClientBasic(
                                                                  a,
                                                              );
                                                          setQsClient(client);
                                                          setQsEdit(a);
                                                          setQsOpen(true);
                                                      }
                                                    : undefined
                                            }
                                            onResolvePending={appt => {
                                                setPendingAppt(
                                                    appt as Appointment,
                                                );
                                                setPendingOpen(true);
                                            }}
                                            onDetails={
                                                a.status === 'done'
                                                    ? appt => {
                                                          setDetailsAppt(
                                                              appt as Appointment,
                                                          );
                                                          setDetailsOpen(true);
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
