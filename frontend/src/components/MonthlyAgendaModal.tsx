import React from 'react';
import AppModal from './Modal';
import AppointmentDetailsModal from './AppointmentDetailsModal';
import {
    useAppointmentsRange,
    type Appointment,
} from '../hooks/useAppointments';
import type { ClientBasic } from '../types/ClientBasic';
import { getAppointmentOverride } from '../utils/appointments/overrides';
import { deriveStatus } from '../utils/appointments/status';
import ClientCardRow from './shared/ClientCardRow';
// PendingActionsModal é global (Home)
import StickyModalHeader from './shared/StickyModalHeader';
import { FaArrowLeft, FaArrowRight } from 'react-icons/fa';
import FloatingDatePicker from './FloatingDatePicker';
import { cancelAppointment } from '../services/appointments';
import { dispatchers } from '../events/dispatchers';
import { useAgendaFinalizeAction } from '../hooks/useAgendaFinalizeAction';

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

function toISODate(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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

export default function MonthlyAgendaModal({
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

    const [month, setMonth] = React.useState<Date>(() =>
        startOfMonth(initialMonth ? new Date(initialMonth) : new Date()),
    );
    const [statusFilter] = React.useState<StatusFilter>('all');
    const [reloadKey, setReloadKey] = React.useState(0);
    const [visibleDaysCount, setVisibleDaysCount] = React.useState<number>(14);

    const monthStart = React.useMemo(() => startOfMonth(month), [month]);
    const monthEnd = React.useMemo(() => endOfMonth(month), [month]);
    const { items, loading } = useAppointmentsRange(
        monthStart,
        monthEnd,
        client?.id,
        reloadKey,
    );

    // PendingActions é global — sem estado local

    // Removido listener local — Home coordena
    const [detailsOpen, setDetailsOpen] = React.useState(false);
    const [detailsAppt, setDetailsAppt] = React.useState<Appointment | null>(
        null,
    );
    const [cancelError, setCancelError] = React.useState<string | null>(null);
    const { handleFinalize } = useAgendaFinalizeAction(() => {
        setReloadKey(x => x + 1);
    });

    const filteredItems = React.useMemo(() => {
        const now = effectiveNowRef;
        return items.filter(a => {
            const ov = getAppointmentOverride(a.id)?.status;
            const status =
                (ov as 'scheduled' | 'done' | 'canceled') ?? a.status;
            const start = new Date(a.start_at);
            const end = new Date(a.end_at);
            switch (statusFilter) {
                case 'all':
                    return true;
                case 'active':
                    return status === 'scheduled' && end >= now;
                case 'ongoing':
                    return status === 'scheduled' && start <= now && end > now;
                case 'past':
                    return status === 'scheduled' && end < now;
                case 'done':
                    return status === 'done';
                case 'canceled':
                    return status === 'canceled';
                default:
                    return true;
            }
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
                {/* Linha 1: Hoje + ano com setas */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
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
                            color: 'var(--color-success-dark)',
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
                            color: 'var(--color-success-dark)',
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
                            color: 'var(--color-success-dark)',
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
                                        ? 'var(--color-success-dark)'
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
                                        const end = new Date(a.end_at);
                                        const now = effectiveNowRef;
                                        const derivedStatus = deriveStatus(
                                            a,
                                            now,
                                        );
                                        const isPending =
                                            a.status === 'scheduled' &&
                                            end < now;
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
                                                    timeSize='md'
                                                    timeOrder='start-top'
                                                    style={{
                                                        padding: '6px 8px',
                                                        // Garante que nome + pill não quebrem em layout estreito
                                                        minWidth: 0,
                                                    }}
                                                    onClick={
                                                        isPending
                                                            ? () => {
                                                                  try {
                                                                      const x =
                                                                          a as Appointment;
                                                                      const anyAppt =
                                                                          x as unknown as Record<
                                                                              string,
                                                                              unknown
                                                                          >;
                                                                      const clientName =
                                                                          (():
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
                                                                                  typeof c ===
                                                                                      'object' &&
                                                                                  'name' in
                                                                                      (c as Record<
                                                                                          string,
                                                                                          unknown
                                                                                      >)
                                                                              ) {
                                                                                  const n =
                                                                                      (
                                                                                          c as {
                                                                                              name?: unknown;
                                                                                          }
                                                                                      )
                                                                                          .name;
                                                                                  if (
                                                                                      typeof n ===
                                                                                      'string'
                                                                                  )
                                                                                      return n;
                                                                              }
                                                                              return undefined;
                                                                          })();
                                                                      const clientField =
                                                                          ((): unknown => {
                                                                              const c =
                                                                                  anyAppt.client as unknown;
                                                                              if (
                                                                                  typeof c ===
                                                                                      'number' ||
                                                                                  typeof c ===
                                                                                      'object'
                                                                              )
                                                                                  return c;
                                                                              return undefined;
                                                                          })();
                                                                      const payload =
                                                                          {
                                                                              id: x.id,
                                                                              start_at:
                                                                                  x.start_at,
                                                                              end_at: x.end_at,
                                                                              status: x.status,
                                                                              notes: x.notes,
                                                                              client_name:
                                                                                  clientName,
                                                                              client: clientField,
                                                                              title: x.title,
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
                                    onClick={() =>
                                        setVisibleDaysCount(c =>
                                            Math.min(c + 7, sortedDays.length),
                                        )
                                    }
                                    style={{ padding: '8px 12px' }}
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
                initialPosition={pickerPos}
            />
        </AppModal>
    );
}
