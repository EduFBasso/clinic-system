import React from 'react';
import FloatingDatePicker from '../components/FloatingDatePicker';
import { FaArrowLeft, FaArrowRight, FaCalendarAlt } from 'react-icons/fa';
import ClientCardRow from '../components/shared/ClientCardRow';
import QuickScheduleModal from '../components/QuickScheduleModal';
// PendingActionsModal agora é gerenciado globalmente em Home via evento 'pendingActions:open'
import AppointmentDetailsModal from '../components/AppointmentDetailsModal';
import type { Appointment } from '../hooks/useAppointments';
import { useAppointmentsRange } from '../hooks/useAppointments';
import type { ClientBasic } from '../types/ClientBasic';
import InlineAppointmentEditor from '../components/InlineAppointmentEditor';
import TimeRangeLabel from '../components/shared/TimeRangeLabel';
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
import { API_BASE } from '../config/api';
import { useLocation } from 'react-router-dom';
import { cancelAppointment } from '../services/appointments';
import { dispatchers } from '../events/dispatchers';
import { useAgendaFinalizeAction } from '../hooks/useAgendaFinalizeAction';
import { openPendingActionsForAppointment } from '../utils/appointments/openPendingActions';

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
type RawClientField = ClientLike | number | undefined | null;
type EnrichedAppt = Appointment & {
    _start: Date;
    _end: Date;
    _isPast: boolean;
    _isOngoing: boolean;
    _derivedStatus: 'scheduled' | 'done' | 'canceled' | 'ongoing' | 'past';
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
    const location = useLocation();
    // Removido: estado local de PendingActions; usar evento global
    const [detailsOpen, setDetailsOpen] = React.useState(false);
    const [detailsAppt, setDetailsAppt] = React.useState<Appointment | null>(
        null,
    );

    // Reabre AppointmentDetailsModal após retorno da página de registro/edição de charges
    React.useEffect(() => {
        const raw = sessionStorage.getItem('reopenAppointmentDetails');
        if (!raw) return;
        sessionStorage.removeItem('reopenAppointmentDetails');
        const apptId = parseInt(raw, 10);
        if (!apptId) return;
        const token = localStorage.getItem('accessToken');
        if (!token) return;
        fetch(`${API_BASE}/agenda/appointments/${apptId}/`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => (r.ok ? r.json() : null))
            .then(appt => {
                if (appt) {
                    setDetailsAppt(appt as Appointment);
                    setDetailsOpen(true);
                }
            })
            .catch(() => {
                /* noop */
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location]);

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
    const { handleFinalize } = useAgendaFinalizeAction(() => {
        setReloadKey(x => x + 1);
    });
    const handleCancel = React.useCallback(async (appt: Appointment) => {
        const res = await cancelAppointment(appt.id);
        if (!res.ok) {
            const msg = res.text || 'Erro ao cancelar';
            try {
                window.dispatchEvent(
                    new CustomEvent('systemMessage', {
                        detail: { text: msg, type: 'warning' },
                    }),
                );
            } catch {
                /* noop */
            }
            return;
        }
        setReloadKey(x => x + 1);
        try {
            dispatchers.updateClients();
            dispatchers.appointmentsChanged();
        } catch {
            /* noop */
        }
    }, []);
    const [statusFilter, setStatusFilter] = React.useState<
        'all' | 'active' | 'past' | 'done' | 'canceled' | 'ongoing'
    >('active');

    // Reactive now — ticks every 30 s to detect ongoing/past transitions
    const effectiveNowRef = useNowTick(30_000);

    // Recarregar quando qualquer compromisso for criado/alterado/cancelado
    React.useEffect(() => {
        const onChanged = () => setReloadKey(x => x + 1);
        window.addEventListener('appointments:changed', onChanged);
        return () =>
            window.removeEventListener('appointments:changed', onChanged);
    }, []);

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

    // QuickSchedule: abrir em modo edição ao tocar no cartão
    const [qsOpen, setQsOpen] = React.useState(false);
    const [qsClient, setQsClient] = React.useState<ClientBasic | null>(null);
    const [qsEdit, setQsEdit] = React.useState<Appointment | null>(null);
    const [inlineEditId, setInlineEditId] = React.useState<number | null>(null);

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

            {/* Linha 2: navegação de data (esquerda) + filtro de status (direita) */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    position: 'sticky',
                    top: 54,
                    zIndex: 15,
                    background: 'var(--color-bg)',
                    borderBottom: '1px solid var(--color-border)',
                    paddingBottom: 8,
                }}
            >
                {/* Navegação de data */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                {/* Filtro de status — botões inline (direita) */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginLeft: 'auto',
                        flexWrap: 'wrap',
                    }}
                >
                    {[
                        { key: 'all' as const, label: 'Todos' },
                        { key: 'ongoing' as const, label: 'Atendimento' },
                        { key: 'past' as const, label: 'Pendentes' },
                        { key: 'active' as const, label: 'Ativos' },
                        { key: 'done' as const, label: 'Concluídos' },
                        { key: 'canceled' as const, label: 'Cancelados' },
                    ].map(({ key, label }) => {
                        const activeBg =
                            key === 'ongoing'
                                ? 'var(--color-ongoing)'
                                : key === 'past'
                                  ? 'var(--color-pending)'
                                  : key === 'active'
                                    ? 'var(--color-primary)'
                                    : key === 'done'
                                      ? 'var(--color-done)'
                                      : key === 'canceled'
                                        ? 'var(--color-canceled)'
                                        : 'var(--color-heading)';
                        return (
                            <button
                                key={key}
                                onClick={() => setStatusFilter(key)}
                                aria-pressed={statusFilter === key}
                                style={{
                                    fontSize: 'var(--font-body)',
                                    fontWeight:
                                        statusFilter === key ? 700 : 500,
                                    padding: '4px 10px',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    border:
                                        statusFilter === key
                                            ? `1px solid ${activeBg}`
                                            : '1px solid var(--color-border)',
                                    background:
                                        statusFilter === key
                                            ? activeBg
                                            : 'var(--color-bg)',
                                    color:
                                        statusFilter === key
                                            ? 'white'
                                            : 'var(--color-text)',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>

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
                        const isActive =
                            a.status === 'scheduled' &&
                            !a._isPast &&
                            !a._isOngoing;
                        const isEditing = inlineEditId === a.id;
                        return (
                            <div
                                key={a.id}
                                data-appt-wrapper-id={a.id}
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
                                            onEdit={
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
                                                openPendingActionsForAppointment(appt);
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
                                            onCancel={
                                                (a.status === 'scheduled' ||
                                                    a.status === 'ongoing' ||
                                                    a._isOngoing) &&
                                                !(a.status === 'scheduled' &&
                                                    !a._isOngoing &&
                                                    a._end < effectiveNowRef)
                                                    ? handleCancel
                                                    : undefined
                                            }
                                            onFinalize={
                                                a.status === 'ongoing' ||
                                                a._isOngoing
                                                    ? handleFinalize
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
                    afterPersist={(_, action) => {
                        if (action === 'created' || (action === 'updated' && !!qsEdit)) {
                            setQsOpen(false);
                        }
                        setReloadKey(x => x + 1);
                    }}
                />
            )}
            {/* PendingActionsModal renderizado globalmente em Home */}
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
