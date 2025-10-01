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
import PendingActionsModal from './PendingActionsModal';

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
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

function parseISODateLocal(iso: string) {
    const [y, m, d] = iso.split('-').map(n => parseInt(n, 10));
    return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

function groupByDay(items: Appointment[]) {
    const map: Record<string, Appointment[]> = {};
    for (const a of items) {
        const key = toISODate(new Date(a.start_at));
        if (!map[key]) map[key] = [];
        map[key].push(a);
    }
    for (const k of Object.keys(map)) {
        map[k].sort(
            (a, b) =>
                new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
        );
    }
    return map;
}

type StatusFilter = 'all' | 'active' | 'ongoing' | 'past' | 'done' | 'canceled';

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
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
    const [dayFilter, setDayFilter] = React.useState<'all' | string>('all');
    const [reloadKey, setReloadKey] = React.useState(0);
    // Limit rendering for heavy clients (many appointments/days)
    const [visibleDaysCount, setVisibleDaysCount] = React.useState<number>(14);

    const monthStart = React.useMemo(() => startOfMonth(month), [month]);
    const monthEnd = React.useMemo(() => endOfMonth(month), [month]);
    const { items, loading } = useAppointmentsRange(
        monthStart,
        monthEnd,
        client?.id,
        reloadKey,
    );

    const [pendingOpen, setPendingOpen] = React.useState(false);
    const [pendingAppt, setPendingAppt] = React.useState<Appointment | null>(
        null,
    );
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

    // All calendar days for the current month (for the day dropdown)
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
        // Ao abrir: sempre mostrar "Todos os dias" por padrão
        setDayFilter('all');
    }, [open]);

    React.useEffect(() => {
        if (!open) return;
        // Ao trocar de mês, se um dia específico estiver selecionado e for inválido no novo mês,
        // voltamos para 'all'.  Caso contrário, preservamos a escolha do usuário.
        if (dayFilter !== 'all' && !allMonthDays.includes(dayFilter)) {
            setDayFilter('all');
        }
    }, [month, allMonthDays, open, dayFilter]);

    // Reload when external appointment changes happen
    React.useEffect(() => {
        // Debounce external refresh events to avoid rapid re-renders (helps mobile stability)
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

    // Compute which days to render based on filter and virtualization
    const sortedDays = React.useMemo(
        () => Object.keys(groupedFiltered).sort(),
        [groupedFiltered],
    );
    // Heuristic: reduce initial visible days for very heavy lists
    React.useEffect(() => {
        if (!open) return;
        // If many appointments in this month, start smaller to improve iOS performance
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
                <div
                    style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 900,
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
                                    fontSize:
                                        'clamp(18px, 4.6vw, var(--font-title-lg))',
                                    color: 'var(--color-heading)',
                                    // Truncation for long names
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    minWidth: 0,
                                    flex: '1 1 auto',
                                }}
                                aria-label='Título: Agenda mensal por cliente'
                            >
                                {`Agenda — ${client.first_name} ${client.last_name}`}
                            </div>
                            <button
                                type='button'
                                aria-label='Fechar'
                                onClick={onClose}
                                style={{
                                    width: 44,
                                    height: 44,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'transparent',
                                    border: 'none',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    color: 'var(--color-heading)',
                                    fontSize: 26,
                                }}
                            >
                                ×
                            </button>
                        </div>
                        {/* Nome do cliente agora está incorporado ao título acima */}

                        {/* Linha de data (segunda linha): Dia (esquerda) + Navegação de mês/ano (direita) */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                                minWidth: 0,
                            }}
                        >
                            <div>
                                <select
                                    value={dayFilter}
                                    onChange={e =>
                                        setDayFilter(
                                            e.target.value as 'all' | string,
                                        )
                                    }
                                    style={{
                                        padding: '8px 10px',
                                        background: 'var(--color-pending-bg)',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: 6,
                                        color: 'var(--color-text)',
                                        fontWeight: 500,
                                        width: 'auto',
                                    }}
                                    aria-label='Filtro de dia'
                                    title='Escolha um dia do mês'
                                >
                                    <option value='all'>Todos os dias</option>
                                    {allMonthDays.map(dISO => {
                                        const d = parseISODateLocal(dISO);
                                        const label = d.toLocaleDateString(
                                            'pt-BR',
                                            {
                                                weekday: 'short',
                                                day: '2-digit',
                                                month: '2-digit',
                                            },
                                        );
                                        return (
                                            <option key={dISO} value={dISO}>
                                                {label}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    gap: 6,
                                    minWidth: 0,
                                    flex: 1,
                                }}
                            >
                                <button
                                    aria-label='Mês anterior'
                                    onClick={() => {
                                        const d = new Date(month);
                                        d.setMonth(d.getMonth() - 1);
                                        setMonth(d);
                                    }}
                                    style={{
                                        width: 30,
                                        height: 30,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: 'transparent',
                                        border: 'none',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                        color: 'var(--color-success-dark)',
                                        fontSize: 'var(--icon-size-lg)',
                                        userSelect: 'none',
                                    }}
                                >
                                    ◀
                                </button>
                                <button
                                    onClick={() =>
                                        document
                                            .getElementById('hiddenMonthPicker')
                                            ?.click()
                                    }
                                    style={{
                                        padding: '2px 6px',
                                        textAlign: 'center',
                                        fontWeight: 800,
                                        color: 'var(--color-success-dark)',
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        maxWidth: '100%',
                                        fontSize: 'var(--font-body)',
                                    }}
                                    title='Selecionar mês'
                                >
                                    {mName.charAt(0).toUpperCase() +
                                        mName.slice(1)}{' '}
                                    {y}
                                </button>
                                <input
                                    id='hiddenMonthPicker'
                                    type='month'
                                    value={monthValue}
                                    onChange={e => {
                                        const [yy, mm] = e.target.value
                                            .split('-')
                                            .map(Number);
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
                                <button
                                    aria-label='Próximo mês'
                                    onClick={() => {
                                        const d = new Date(month);
                                        d.setMonth(d.getMonth() + 1);
                                        setMonth(d);
                                    }}
                                    style={{
                                        width: 30,
                                        height: 30,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: 'transparent',
                                        border: 'none',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                        color: 'var(--color-success-dark)',
                                        fontSize: 'var(--icon-size-lg)',
                                        userSelect: 'none',
                                    }}
                                >
                                    ▶
                                </button>
                            </div>
                        </div>

                        {/* Linha de status (terceira linha): botão Hoje à esquerda e Status à direita */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                                flexWrap: 'wrap',
                            }}
                        >
                            <div>
                                <button
                                    onClick={() => {
                                        const now = new Date();
                                        const targetMonth = startOfMonth(now);
                                        // Ir para o mês atual, se necessário
                                        if (
                                            targetMonth.getFullYear() !==
                                                month.getFullYear() ||
                                            targetMonth.getMonth() !==
                                                month.getMonth()
                                        ) {
                                            setMonth(targetMonth);
                                        }
                                        // Selecionar o dia de hoje
                                        setDayFilter(toISODate(now));
                                    }}
                                    style={{
                                        padding: '8px 10px',
                                        background:
                                            'var(--color-primary-bg, var(--color-pending-bg))',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: 6,
                                        color: 'var(--color-text)',
                                        fontWeight: 600,
                                    }}
                                    aria-label='Ir para hoje'
                                >
                                    Hoje
                                </button>
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                }}
                            >
                                <label
                                    htmlFor='statusFilterSelect'
                                    style={{
                                        fontSize: 'var(--font-body)',
                                        color: 'var(--color-heading)',
                                        fontWeight: 600,
                                    }}
                                >
                                    Status:
                                </label>
                                <div>
                                    <select
                                        id='statusFilterSelect'
                                        value={statusFilter}
                                        onChange={e =>
                                            setStatusFilter(
                                                e.target.value as StatusFilter,
                                            )
                                        }
                                        style={{
                                            fontSize: 'var(--font-body)',
                                            padding: '8px 10px',
                                            background:
                                                'var(--color-pending-bg)',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: 6,
                                            color: 'var(--color-text)',
                                            fontWeight: 500,
                                            minWidth: 120,
                                            maxWidth: 180,
                                            width: 'auto',
                                        }}
                                        aria-label='Filtro de status'
                                    >
                                        <option value='all'>Todos</option>
                                        <option value='active'>Ativos</option>
                                        <option value='ongoing'>
                                            Em andamento
                                        </option>
                                        <option value='past'>Pendentes</option>
                                        <option value='done'>Concluídos</option>
                                        <option value='canceled'>
                                            Cancelados
                                        </option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

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
                                                    willChange: 'transform',
                                                }}
                                            >
                                                <ClientCardRow
                                                    appt={a as Appointment}
                                                    timeSize='md'
                                                    timeOrder='start-top'
                                                    style={{
                                                        padding: '6px 8px',
                                                    }}
                                                    onClick={
                                                        isPending
                                                            ? () => {
                                                                  setPendingAppt(
                                                                      a as Appointment,
                                                                  );
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
        </AppModal>
    );
}
