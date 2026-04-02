import React from 'react';
import AppModal from './Modal';
import AppointmentDetailsModal from './AppointmentDetailsModal';
import {
    useAppointmentsRange,
    type Appointment,
} from '../hooks/useAppointments';
import type { ClientBasic } from '../types/ClientBasic';
import { getAppointmentOverride } from '../utils/appointments/overrides';
import ClientCardRow from './shared/ClientCardRow';
// PendingActionsModal é global (Home)
import StickyModalHeader from './shared/StickyModalHeader';
import { FaArrowLeft, FaArrowRight, FaCalendarAlt } from 'react-icons/fa';

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
    const [month, setMonth] = React.useState<Date>(() =>
        startOfMonth(initialMonth ? new Date(initialMonth) : new Date()),
    );
    const [statusFilter] = React.useState<StatusFilter>('all');
    // dayFilter agora é interno (UI removida). Mantemos para possível scroll focado.
    const [dayFilter, setDayFilter] = React.useState<'all' | string>('all');
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

    const allMonthDays = React.useMemo(() => {
        const days: string[] = [];
        const d = new Date(monthStart);
        while (d < monthEnd) {
            days.push(toISODate(d));
            d.setDate(d.getDate() + 1);
        }
        return days;
    }, [monthStart, monthEnd]);

    React.useEffect(() => {
        if (!open) return;
        setDayFilter('all');
    }, [open]);

    React.useEffect(() => {
        if (!open) return;
        if (dayFilter !== 'all' && !allMonthDays.includes(dayFilter)) {
            setDayFilter('all');
        }
    }, [month, allMonthDays, open, dayFilter]);

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

    const mName = React.useMemo(
        () => month.toLocaleString('pt-BR', { month: 'long' }),
        [month],
    );
    const y = month.getFullYear();
    const monthValue = `${y}-${String(month.getMonth() + 1).padStart(2, '0')}`;

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
                title={`Agenda mensal — ${client.first_name} ${client.last_name}`}
                onClose={onClose}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        flexWrap: 'wrap',
                    }}
                >
                    <button
                        onClick={() => {
                            const now = new Date();
                            setMonth(startOfMonth(now));
                            setDayFilter(toISODate(now));
                            // Scroll até o dia de hoje se listado (após frame)
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
                        aria-label='Ir para hoje'
                    >
                        Hoje
                    </button>
                    <button
                        type='button'
                        onClick={() =>
                            document
                                .getElementById('hiddenMonthPicker')
                                ?.click()
                        }
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
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                        }}
                    >
                        <button
                            onClick={() => {
                                const d = new Date(month);
                                d.setMonth(d.getMonth() - 1);
                                setMonth(d);
                            }}
                            title='Mês anterior'
                            aria-label='Mês anterior'
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
                        >
                            <FaArrowLeft />
                        </button>
                        <button
                            onClick={() =>
                                document
                                    .getElementById('hiddenMonthPicker')
                                    ?.click()
                            }
                            title={`Selecionar mês — ${client.first_name} ${client.last_name}`}
                            aria-label='Selecionar mês'
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--color-success-dark)',
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                                userSelect: 'none',
                            }}
                        >
                            {mName.charAt(0).toUpperCase() + mName.slice(1)} {y}
                        </button>
                        <button
                            onClick={() => {
                                const d = new Date(month);
                                d.setMonth(d.getMonth() + 1);
                                setMonth(d);
                            }}
                            title='Próximo mês'
                            aria-label='Próximo mês'
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
                        >
                            <FaArrowRight />
                        </button>
                    </div>
                </div>
                <input
                    id='hiddenMonthPicker'
                    type='month'
                    value={monthValue}
                    onChange={e => {
                        const [yy, mm] = e.target.value.split('-').map(Number);
                        const d = new Date(month);
                        d.setFullYear(yy);
                        d.setMonth((mm || 1) - 1);
                        d.setDate(1);
                        setMonth(d);
                    }}
                    style={{
                        position: 'absolute',
                        opacity: 0,
                        width: 0,
                        height: 0,
                        pointerEvents: 'none',
                    }}
                    aria-hidden='true'
                    tabIndex={-1}
                />
            </StickyModalHeader>

            <div
                style={{
                    display: 'grid',
                    gap: 12,
                    margin: '0 auto',
                    width: '100%',
                    maxWidth: '520px',
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
                        {(dayFilter === 'all'
                            ? sortedDays.slice(0, visibleDaysCount)
                            : [dayFilter]
                        ).map(dayISO => {
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
                                            color: '#374151',
                                        }}
                                    >
                                        {label}
                                    </div>
                                    {(groupedFiltered[dayISO] || []).length ===
                                        0 && dayFilter !== 'all' ? (
                                        <div
                                            style={{
                                                color: 'var(--color-muted)',
                                            }}
                                        >
                                            Nenhum compromisso neste dia.
                                        </div>
                                    ) : null}
                                    {(groupedFiltered[dayISO] || []).map(a => {
                                        const end = new Date(a.end_at);
                                        const now = effectiveNowRef;
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
                        {dayFilter === 'all' &&
                            visibleDaysCount < sortedDays.length && (
                                <div
                                    style={{
                                        textAlign: 'center',
                                        padding: '8px 0',
                                    }}
                                >
                                    <button
                                        onClick={() =>
                                            setVisibleDaysCount(c =>
                                                Math.min(
                                                    c + 7,
                                                    sortedDays.length,
                                                ),
                                            )
                                        }
                                        style={{ padding: '8px 12px' }}
                                        aria-label='Carregar mais dias'
                                    >
                                        Mostrar mais dias
                                    </button>
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
        </AppModal>
    );
}
