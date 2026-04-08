import React from 'react';
import AppModal from './Modal';
import FloatingDatePicker from './FloatingDatePicker';
import StickyModalHeader from './shared/StickyModalHeader';
import { FaArrowLeft, FaArrowRight, FaCalendarAlt } from 'react-icons/fa';
import ClientCardRow from './shared/ClientCardRow';
import { enrichList } from '../utils/appointments/status';
import { getAppointmentOverride } from '../utils/appointments/overrides';
import {
    STATUS_ORDER,
    isClientLike,
    makeClientBasic,
    matchesStatusFilter,
    type ClientLike,
} from '../utils/appointments/agendaHelpers';
import { useNowTick } from '../hooks/useNowTick';
import QuickScheduleModal from './QuickScheduleModal';
// PendingActionsModal é global (Home)
import AppointmentDetailsModal from './AppointmentDetailsModal';
import type { Appointment } from '../hooks/useAppointments';
import { useAppointmentsRange } from '../hooks/useAppointments';
import type { ClientBasic } from '../types/ClientBasic';
import { focusClientCard } from '../utils/focusClientCard';

interface DailyAgendaModalProps {
    open: boolean;
    date: Date;
    onClose: () => void;
    focusAppointmentId?: number;
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

type StatusKey = 'scheduled' | 'done' | 'canceled' | 'ongoing';
export default function DailyAgendaModal({
    open,
    date,
    onClose,
    focusAppointmentId,
}: DailyAgendaModalProps) {
    // Floating picker state/position (consistent with QuickScheduleModal)
    const [showPicker, setShowPicker] = React.useState(false);
    const [pickerPos, setPickerPos] = React.useState<
        { x: number; y: number } | undefined
    >(undefined);
    const openDatePicker = React.useCallback(
        (ev?: React.MouseEvent | React.PointerEvent | React.TouchEvent) => {
            // Compute a nice initial position near the tap/click
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
    const [selectedDay, setSelectedDay] = React.useState(startOfDay(date));
    React.useEffect(() => {
        if (open) setSelectedDay(startOfDay(date));
    }, [open, date]);
    const [reloadKey, setReloadKey] = React.useState(0);
    // PendingActions é global — nenhum estado local

    // Removido listener local de forceClose — Home coordena
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

    // Forçar um refetch imediato ao abrir (caso evento appointments:changed tenha sido perdido antes de abrir)
    const prevOpenRef = React.useRef(open);
    React.useEffect(() => {
        if (!prevOpenRef.current && open) {
            // pequeno atraso para garantir que POST de criação já foi commitado
            const t = setTimeout(() => setReloadKey(x => x + 1), 80);
            return () => clearTimeout(t);
        }
        prevOpenRef.current = open;
    }, [open]);

    // Instrumentação opcional: localStorage.setItem('debugAppointments','1')
    React.useEffect(() => {
        if (!open) return;
        if (localStorage.getItem('debugAppointments') === '1') {
            try {
                console.debug('[DailyAgendaModal][debug] window', {
                    dayStart: dayStart.toISOString(),
                    dayEnd: dayEnd.toISOString(),
                    count: items.length,
                    loading,
                    reloadKey,
                });
            } catch {
                /* noop */
            }
        }
    }, [open, items, loading, reloadKey, dayStart, dayEnd]);
    const [statusFilter, setStatusFilter] = React.useState<
        'all' | 'active' | 'past' | 'done' | 'canceled' | 'ongoing'
    >('all');

    type EnrichedAppt = Appointment & {
        _start: Date;
        _end: Date;
        _isPast: boolean;
        _isOngoing: boolean;
        client?: ClientLike | number;
    };
    // Reactive now — ticks every 30 s so ongoing/past status stays accurate
    const effectiveNowRef = useNowTick(30_000);

    const enriched: EnrichedAppt[] = React.useMemo(() => {
        const nowRef = effectiveNowRef;
        // Reuse shared enrich to compute _isPast/_isOngoing and then reattach optional client shape
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
                )
                    client = candidate;
            }
            return { ...a, ...(client ? { client } : {}) } as EnrichedAppt;
        });
    }, [items, effectiveNowRef]);

    // Recarrega quando houver mudanças externas de compromissos
    React.useEffect(() => {
        if (!open) return;
        const onChanged = () => setReloadKey(x => x + 1);
        window.addEventListener('appointments:changed', onChanged);
        return () =>
            window.removeEventListener('appointments:changed', onChanged);
    }, [open]);

    // Quando algum compromisso entra em andamento, rolar até o cartão do cliente (como no filtro dinâmico)
    React.useEffect(() => {
        if (!open) return;
        try {
            const anyOngoing = enriched.find(
                a => a.status === 'ongoing' || a._isOngoing,
            );
            if (anyOngoing) {
                const c: ClientLike | number | undefined = anyOngoing.client as
                    | ClientLike
                    | number
                    | undefined;
                const clientId = typeof c === 'number' ? c : c?.id;
                if (clientId) focusClientCard(clientId);
            }
        } catch {
            /* noop */
        }
    }, [open, enriched]);

    const filtered = enriched.filter(a => {
        const ov = getAppointmentOverride(a.id)?.status;
        return matchesStatusFilter(statusFilter, a, ov);
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
        const id = focusAppointmentId;
        const to = setTimeout(() => {
            const el = document.querySelector(`[data-appt-id="${id}"]`);
            if (el) el.scrollIntoView({ block: 'center' });
        }, 150);
        return () => clearTimeout(to);
    }, [open, focusAppointmentId, sorted]);

    // QuickSchedule: abrir em modo edição ao tocar no cartão
    const [qsOpen, setQsOpen] = React.useState(false);
    const [qsClient, setQsClient] = React.useState<ClientBasic | null>(null);
    const [qsEdit, setQsEdit] = React.useState<Appointment | null>(null);

    return (
        <AppModal
            open={open}
            onClose={onClose}
            fullScreen
            actionsBarStyle={{
                background: 'transparent',
                boxShadow: 'none',
                borderBottom: 'none',
            }}
            showCloseButton={false}
            disableTopSafePadding
            disableOuterScroll
        >
            <StickyModalHeader title='Agenda diária' onClose={onClose}>
                <div style={{ display: 'grid', gap: 10 }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                        }}
                    >
                        <button
                            onClick={() =>
                                setSelectedDay(startOfDay(new Date()))
                            }
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
                                onClick={() =>
                                    setSelectedDay(addDays(selectedDay, -1))
                                }
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
                                    fontWeight:
                                        'var(--heading-weight-md)' as unknown as number,
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
                                onClick={() =>
                                    setSelectedDay(addDays(selectedDay, 1))
                                }
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
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            flexWrap: 'wrap',
                        }}
                    >
                        <select
                            value={statusFilter}
                            onChange={e =>
                                setStatusFilter(
                                    e.target.value as typeof statusFilter,
                                )
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
                </div>
            </StickyModalHeader>
            {/* Wrapper scrollável interno (AppModal com disableOuterScroll) */}
            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    paddingTop: 8,
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
                                <ClientCardRow
                                    appt={a}
                                    timeSize='md'
                                    timeOrder='start-top'
                                    style={{ padding: '6px 8px' }}
                                    cardContainerStyle={{
                                        maxWidth: 'min(704px, 94%)',
                                    }}
                                    showEditAction={false}
                                    onClick={() => {
                                        const client = makeClientBasic(a);
                                        setQsClient(client);
                                        setQsEdit(a);
                                        setQsOpen(true);
                                    }}
                                    onResolvePending={appt => {
                                        try {
                                            const a = appt as Appointment;
                                            const anyAppt =
                                                a as unknown as Record<
                                                    string,
                                                    unknown
                                                >;
                                            const clientName = (():
                                                | string
                                                | undefined => {
                                                if (
                                                    typeof anyAppt.client_name ===
                                                    'string'
                                                )
                                                    return anyAppt.client_name as string;
                                                const c =
                                                    anyAppt.client as unknown;
                                                if (
                                                    c &&
                                                    typeof c === 'object' &&
                                                    'name' in
                                                        (c as Record<
                                                            string,
                                                            unknown
                                                        >)
                                                ) {
                                                    const n = (
                                                        c as {
                                                            name?: unknown;
                                                        }
                                                    ).name;
                                                    if (typeof n === 'string')
                                                        return n;
                                                }
                                                return undefined;
                                            })();
                                            const clientField =
                                                ((): unknown => {
                                                    const c =
                                                        anyAppt.client as unknown;
                                                    if (
                                                        typeof c === 'number' ||
                                                        typeof c === 'object'
                                                    )
                                                        return c;
                                                    return undefined;
                                                })();
                                            const payload = {
                                                id: a.id,
                                                start_at: a.start_at,
                                                end_at: a.end_at,
                                                status: a.status,
                                                notes: a.notes,
                                                client_name: clientName,
                                                client: clientField,
                                                title: a.title,
                                            } as unknown as import('../components/shared/AppointmentCard').SharedAppointmentLike;
                                            window.dispatchEvent(
                                                new CustomEvent(
                                                    'pendingActions:open',
                                                    {
                                                        detail: {
                                                            appt: payload,
                                                        },
                                                    },
                                                ),
                                            );
                                        } catch {
                                            /* noop */
                                        }
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
                                    highlight={focusAppointmentId === a.id}
                                />
                            </div>
                        );
                    })}
            </div>
            {/* FloatingDatePicker consistente com QuickSchedule */}
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
            {/* QuickScheduleModal para edição */}
            {qsOpen && qsClient && (
                <QuickScheduleModal
                    open={qsOpen}
                    onClose={() => setQsOpen(false)}
                    client={qsClient}
                    editAppointment={qsEdit}
                    afterPersist={() => {
                        setQsOpen(false);
                        setReloadKey(x => x + 1); // força recarregar agenda diária
                    }}
                />
            )}
            {/* PendingActionsModal é global (Home) */}
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
        </AppModal>
    );
}
