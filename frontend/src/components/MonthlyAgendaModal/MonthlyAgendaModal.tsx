import React from 'react';
import { AppModal } from '../Modal/Modal';
import {
    useAppointmentsRange,
    type Appointment,
} from '../../hooks/useAppointments';
import { useAppointmentDetailsModal } from '../../hooks/useAppointmentDetailsModal';
import type { ClientBasic } from '../../types/ClientBasic';
import { matchesStatusFilter } from '../../utils/appointments/agendaHelpers';
import { openPendingActionsForAppointment } from '../../utils/appointments/openPendingActions';
import { enrichList, deriveStatus } from '../../utils/appointments/status';
import ClientCardRow from '../shared/ClientCardRow';
// PendingActionsModal é global (Home)
import StickyModalHeader from '../shared/StickyModalHeader';
import { FaArrowLeft, FaArrowRight } from 'react-icons/fa';
import FloatingDatePicker from '../FloatingDatePicker';
import { cancelAppointment } from '../../services/appointments';
import { dispatchers } from '../../events/dispatchers';
import { useAgendaFinalizeAction } from '../../hooks/useAgendaFinalizeAction';
import type { PendingReturnContext } from '../../types/agendaFlow';
import QuickScheduleModal from '../QuickScheduleModal';
import { makeClientBasic } from '../../utils/appointments/agendaHelpers';
import { toISODate } from '../../utils/date';

function startOfMonth(d: Date) {
    const x = new Date(d);
    x.setDate(1);
    x.setHours(0, 0, 0, 0);
    return x;
}
function endOfMonth(d: Date) {
    const x = startOfMonth(d);
    x.setMonth(x.getMonth() + 1);
    return x; // exclusive end
}

function parseISODateLocal(iso: string) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

type StatusFilter = 'all' | 'active' | 'ongoing' | 'past' | 'done' | 'canceled';

function groupByDay(items: Appointment[]) {
    const out: Record<string, Appointment[]> = {};
    for (const a of items) {
        const day = toISODate(new Date(a.start_at));
        (out[day] ||= []).push(a);
    }
    return out;
}

export function MonthlyAgendaModal({
    open,
    onClose,
    client,
    initialMonth,
}: {
    open: boolean;
    onClose: () => void;
    client: ClientBasic;
    initialMonth?: Date;
}) {
    const effectiveNowRef = React.useMemo(() => new Date(), []);
    // Floating date picker state — consistent with DailyAgendaModal / WeeklyAgendaModal
    const [showPicker, setShowPicker] = React.useState(false);

    const [month, setMonth] = React.useState<Date>(() =>
        startOfMonth(initialMonth ? new Date(initialMonth) : new Date()),
    );
    const [statusFilter] = React.useState<StatusFilter>('all');
    const [reloadKey, setReloadKey] = React.useState(0);
    const [visibleDaysCount, setVisibleDaysCount] = React.useState<number>(14);

    const monthStart = React.useMemo(() => startOfMonth(month), [month]);
    const buildReturnContext = React.useCallback(
        (): PendingReturnContext => ({
            kind: 'monthly-agenda',
            clientId: client.id,
            monthISO: toISODate(monthStart),
        }),
        [client.id, monthStart],
    );
    const monthEnd = React.useMemo(() => endOfMonth(month), [month]);
    const { items, loading } = useAppointmentsRange(
        monthStart,
        monthEnd,
        client?.id,
        reloadKey,
    );

    // PendingActions é global — sem estado local

    // Removido listener local — Home coordena
    const { detailsModal, openDetails } =
        useAppointmentDetailsModal<Appointment>();
    const [cancelError, setCancelError] = React.useState<string | null>(null);

    // QuickSchedule: abrir em modo edição ao tocar no cartão
    const [qsOpen, setQsOpen] = React.useState(false);
    const [qsClient, setQsClient] = React.useState<ClientBasic | null>(null);
    const [qsEdit, setQsEdit] = React.useState<Appointment | null>(null);
    const closeQuickSchedule = React.useCallback(() => {
        setQsOpen(false);
        setQsEdit(null);
        setQsClient(null);
    }, []);
    const { handleFinalize } = useAgendaFinalizeAction(() => {
        setReloadKey(x => x + 1);
    });

    const filteredItems = React.useMemo(() => {
        return enrichList(items, effectiveNowRef).filter(a => {
            return matchesStatusFilter(statusFilter, a);
        });
    }, [items, statusFilter, effectiveNowRef]);

    const groupedFiltered = React.useMemo(
        () => groupByDay(filteredItems),
        [filteredItems],
    );

    React.useEffect(() => {
        let t: number | undefined;
        const onChanged = () => {
            if (t) window.clearTimeout(t);
            t = window.setTimeout(() => setReloadKey(x => x + 1), 180);
        };
        window.addEventListener('appointments:changed', onChanged);
        return () => {
            if (t) window.clearTimeout(t);
            window.removeEventListener('appointments:changed', onChanged);
        };
    }, []);

    const y = month.getFullYear();

    const MONTH_ABBR = [
        'Jan',
        'Fev',
        'Mar',
        'Abr',
        'Mai',
        'Jun',
        'Jul',
        'Ago',
        'Set',
        'Out',
        'Nov',
        'Dez',
    ];

    const sortedDays = React.useMemo(
        () => Object.keys(groupedFiltered).sort(),
        [groupedFiltered],
    );

    React.useEffect(() => {
        if (!open) return;
        const total = items.length;
        if (total > 400) setVisibleDaysCount(5);
        else if (total > 250) setVisibleDaysCount(8);
        else setVisibleDaysCount(14);
    }, [open, items.length]);

    return (
        <AppModal
            open={open}
            onClose={onClose}
            unmountOnClose
            actionsBarStyle={{
                background: 'transparent',
                boxShadow: 'none',
                borderBottom: 'none',
            }}
            showCloseButton={false}
            fullScreen
            disableTopSafePadding
        >
            <StickyModalHeader
                title={
                    <>
                        {'Compromissos: '}
                        {client.first_name}
                        <span className='monthly-title-lastname'>
                            {' '}
                            {client.last_name}
                        </span>
                    </>
                }
                onClose={onClose}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                        className='ui-btn ui-btn--theme'
                        onClick={() => {
                            const now = new Date();
                            setMonth(startOfMonth(now));
                            requestAnimationFrame(() => {
                                const id = toISODate(now);
                                const el = document.querySelector(
                                    `[data-day="${id}"]`,
                                );
                                if (el) el.scrollIntoView({ block: 'start' });
                            });
                        }}
                        aria-label='Ir para o mês atual'
                    >
                        Mês Atual
                    </button>
                    <button
                        onClick={() =>
                            setMonth(d => {
                                const x = new Date(d);
                                x.setFullYear(x.getFullYear() - 1);
                                return startOfMonth(x);
                            })
                        }
                        title='Ano anterior'
                        aria-label='Ano anterior'
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--color-primary)',
                            width: 32,
                            height: 32,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 'var(--icon-size-lg)',
                        }}
                    >
                        <FaArrowLeft />
                    </button>
                    <span
                        style={{
                            fontWeight: 700,
                            color: 'var(--color-primary)',
                            minWidth: 40,
                            textAlign: 'center',
                        }}
                    >
                        {y}
                    </span>
                    <button
                        onClick={() =>
                            setMonth(d => {
                                const x = new Date(d);
                                x.setFullYear(x.getFullYear() + 1);
                                return startOfMonth(x);
                            })
                        }
                        title='Próximo ano'
                        aria-label='Próximo ano'
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--color-primary)',
                            width: 32,
                            height: 32,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 'var(--icon-size-lg)',
                        }}
                    >
                        <FaArrowRight />
                    </button>
                </div>
                {/* Linha 2: pills dos 12 meses */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
                        gap: 4,
                        paddingTop: 4,
                        overflowX: 'auto',
                    }}
                >
                    {MONTH_ABBR.map((abbr, idx) => {
                        const selected = month.getMonth() === idx;
                        return (
                            <button
                                key={idx}
                                onClick={() =>
                                    setMonth(startOfMonth(new Date(y, idx, 1)))
                                }
                                aria-pressed={selected}
                                style={{
                                    padding: '6px 4px',
                                    border: 'none',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    fontWeight: selected ? 800 : 500,
                                    fontSize: '0.78rem',
                                    background: selected
                                        ? 'var(--color-primary)'
                                        : 'transparent',
                                    color: selected
                                        ? 'white'
                                        : 'var(--color-text)',
                                    transition: 'background 0.15s',
                                }}
                            >
                                {abbr}
                            </button>
                        );
                    })}
                </div>
            </StickyModalHeader>

            <div
                style={{
                    display: 'grid',
                    gap: 12,
                    width: '100%',
                    maxWidth: 600,
                    marginLeft: 'auto',
                    marginRight: 'auto',
                    paddingLeft: 12,
                    paddingRight: 12,
                    boxSizing: 'border-box',
                }}
            >
                {loading ? (
                    <div>Carregando…</div>
                ) : items.length === 0 ? (
                    <div>Nenhum compromisso neste mês.</div>
                ) : (
                    <div style={{ display: 'grid', gap: 12, paddingTop: 6 }}>
                        {sortedDays.slice(0, visibleDaysCount).map(dayISO => {
                            const day = parseISODateLocal(dayISO);
                            const label = day.toLocaleDateString('pt-BR', {
                                weekday: 'short',
                                day: '2-digit',
                                month: '2-digit',
                            });
                            return (
                                <div
                                    key={dayISO}
                                    data-day={dayISO}
                                    style={{ display: 'grid', gap: 8 }}
                                >
                                    <div
                                        style={{
                                            fontWeight: 600,
                                            color: 'var(--color-pending)',
                                        }}
                                    >
                                        {label}
                                    </div>

                                    {(groupedFiltered[dayISO] || []).map(a => {
                                        const now = effectiveNowRef;
                                        const derivedStatus = deriveStatus(
                                            a,
                                            now,
                                        );
                                        const isPending =
                                            derivedStatus === 'past';
                                        return (
                                            <div
                                                key={a.id}
                                                data-appt-id={a.id}
                                                style={{
                                                    minWidth: 0,
                                                    width: '100%',
                                                    // Evita flicker por reflow quando hover ou pill aparece
                                                    willChange: 'auto',
                                                    // Reserva espaço horizontal para pill + nome
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                }}
                                            >
                                                <ClientCardRow
                                                    appt={a as Appointment}
                                                    showEditAction={false}
                                                    onEdit={
                                                        derivedStatus === 'scheduled' && !isPending
                                                            ? appt => {
                                                                  const client = makeClientBasic(appt);
                                                                  setQsClient(client);
                                                                  setQsEdit(appt as Appointment);
                                                                  setQsOpen(true);
                                                              }
                                                            : undefined
                                                    }
                                                    timeSize='md'
                                                    timeOrder='start-top'
                                                    style={{
                                                        padding: '6px 8px',
                                                        // Garante que nome + pill não quebrem em layout estreito
                                                        minWidth: 0,
                                                    }}
                                                    onClick={
                                                        isPending
                                                            ? () =>
                                                                  openPendingActionsForAppointment(
                                                                      a,
                                                                      buildReturnContext(),
                                                                  )
                                                            : undefined
                                                    }
                                                    onResolvePending={appt =>
                                                        openPendingActionsForAppointment(
                                                            appt as Appointment,
                                                            buildReturnContext(),
                                                        )
                                                    }
                                                    onDetails={
                                                        a.status === 'done'
                                                            ? appt =>
                                                                  openDetails(
                                                                      appt as Appointment,
                                                                      buildReturnContext(),
                                                                  )
                                                            : undefined
                                                    }
                                                    onCancel={
                                                        (derivedStatus ===
                                                            'scheduled' ||
                                                            derivedStatus ===
                                                                'ongoing') &&
                                                        !isPending
                                                            ? async appt => {
                                                                  try {
                                                                      setCancelError(
                                                                          null,
                                                                      );
                                                                      const res =
                                                                          await cancelAppointment(
                                                                              appt.id,
                                                                          );
                                                                      if (
                                                                          !res.ok
                                                                      ) {
                                                                          throw new Error(
                                                                              res.text ||
                                                                                  'Erro ao cancelar',
                                                                          );
                                                                      }
                                                                      setReloadKey(
                                                                          x =>
                                                                              x +
                                                                              1,
                                                                      );
                                                                      try {
                                                                          dispatchers.updateClients();
                                                                          dispatchers.appointmentsChanged();
                                                                      } catch {
                                                                          /* noop */
                                                                      }
                                                                  } catch (
                                                                      err
                                                                  ) {
                                                                      const msg =
                                                                          err &&
                                                                          typeof err ===
                                                                              'object' &&
                                                                          'message' in
                                                                              err
                                                                              ? String(
                                                                                    (
                                                                                        err as Error
                                                                                    )
                                                                                        .message,
                                                                                )
                                                                              : 'Erro ao cancelar';
                                                                      setCancelError(
                                                                          msg,
                                                                      );
                                                                  }
                                                              }
                                                            : undefined
                                                    }
                                                    onFinalize={
                                                        derivedStatus ===
                                                        'ongoing'
                                                            ? handleFinalize
                                                            : undefined
                                                    }
                                                    finalizeRequestContext={buildReturnContext()}
                                                    cardContainerStyle={{
                                                        // Evita que o stripe + conteúdo comprimam o closed pill
                                                        minWidth: 0,
                                                    }}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                        {visibleDaysCount < sortedDays.length && (
                            <div
                                style={{
                                    textAlign: 'center',
                                    padding: '8px 0',
                                }}
                            >
                                <button
                                    className='ui-btn ui-btn--secondary'
                                    onClick={() =>
                                        setVisibleDaysCount(c =>
                                            Math.min(c + 7, sortedDays.length),
                                        )
                                    }
                                    aria-label='Carregar mais dias'
                                >
                                    Mostrar mais dias
                                </button>
                            </div>
                        )}
                        {cancelError && (
                            <div
                                style={{
                                    color: '#b91c1c',
                                    fontSize: 14,
                                    paddingTop: 4,
                                }}
                            >
                                {cancelError}
                            </div>
                        )}
                    </div>
                )}

                {/* PendingActionsModal é global (Home) */}
                {detailsModal}
                {qsOpen && qsClient && (
                    <QuickScheduleModal
                        open={qsOpen}
                        onClose={closeQuickSchedule}
                        client={qsClient}
                        editAppointment={qsEdit}
                        afterPersist={(_, action) => {
                            if (action === 'updated') closeQuickSchedule();
                            setReloadKey(x => x + 1);
                        }}
                    />
                )}
            </div>
            {/* FloatingDatePicker consistente com DailyAgendaModal */}
            <FloatingDatePicker
                open={showPicker}
                onClose={() => setShowPicker(false)}
                selectedDate={month}
                onChange={d => {
                    setMonth(startOfMonth(d));
                    setShowPicker(false);
                    // Scroll até o dia selecionado (sem filtrar a lista)
                    requestAnimationFrame(() => {
                        const dayISO = toISODate(d);
                        const el = document.querySelector(
                            `[data-day="${dayISO}"]`,
                        );
                        if (el) el.scrollIntoView({ block: 'start' });
                    });
                }}
                initialPosition={undefined}
            />
        </AppModal>
    );
}
