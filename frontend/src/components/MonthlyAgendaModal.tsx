import React from 'react';
import AppModal from './Modal';
import AppointmentDetailsModal from './AppointmentDetailsModal';
import {
    useAppointmentsRange,
    type Appointment,
} from '../hooks/useAppointments';
import type { ClientBasic } from '../types/ClientBasic';
import AppointmentCard from './shared/AppointmentCard';
import TimeRangeLabel from './shared/TimeRangeLabel';
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
    const [month, setMonth] = React.useState<Date>(() =>
        startOfMonth(initialMonth ? new Date(initialMonth) : new Date()),
    );
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
    const [reloadKey, setReloadKey] = React.useState(0);

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
    // No explicit error handling in monthly view (no destructive actions here)

    const filteredItems = React.useMemo(() => {
        const now = new Date();
        return items.filter(a => {
            const start = new Date(a.start_at);
            const end = new Date(a.end_at);
            switch (statusFilter) {
                case 'all':
                    return true;
                case 'active':
                    return a.status === 'scheduled' && end >= now;
                case 'ongoing':
                    return (
                        a.status === 'scheduled' && start <= now && end > now
                    );
                case 'past':
                    return a.status === 'scheduled' && end < now;
                case 'done':
                    return a.status === 'done';
                case 'canceled':
                    return a.status === 'canceled';
                default:
                    return true;
            }
        });
    }, [items, statusFilter]);

    const groupedFiltered = React.useMemo(
        () => groupByDay(filteredItems),
        [filteredItems],
    );

    const mName = React.useMemo(
        () =>
            month.toLocaleString('pt-BR', {
                month: 'long',
            }),
        [month],
    );
    const y = month.getFullYear();
    const monthValue = `${y}-${String(month.getMonth() + 1).padStart(2, '0')}`;

    return (
        <AppModal
            open={open}
            onClose={onClose}
            // X bar transparente neste modal específico
            actionsBarStyle={{
                background: 'transparent',
                boxShadow: 'none',
                borderBottom: 'none',
            }}
            showCloseButton={false}
            fullScreen
            disableTopSafePadding
        >
            {/* Container central com largura reduzida e responsiva */}
            <div
                style={{
                    display: 'grid',
                    gap: 12,
                    margin: '0 auto',
                    // Evita extrapolar viewport em desktops: usa 100% até um limite menor
                    width: '100%',
                    // afunila um pouco mais para evitar corte em aparelhos menores
                    maxWidth: '520px',
                    // Evita corte lateral mantendo pequenas margens internas
                    paddingLeft: 12,
                    paddingRight: 12,
                    boxSizing: 'border-box',
                }}
            >
                {/* Sticky header (abaixo da barra do X) */}
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
                        {/* Title + Close aligned */}
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
                                    // Título levemente fluido para caber junto do botão X
                                    fontSize:
                                        'clamp(18px, 4.6vw, var(--font-title-lg))',
                                    color: 'var(--color-heading)',
                                }}
                            >
                                Agenda mensal
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
                        {/* Name line */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'baseline',
                                gap: 8,
                            }}
                        >
                            <span
                                style={{
                                    fontWeight: 400,
                                    color: 'var(--color-heading)',
                                    minWidth: 56,
                                    fontSize: 'var(--font-title-md)',
                                }}
                            >
                                Nome:
                            </span>
                            <span
                                style={{
                                    color: 'var(--color-heading)',
                                    fontWeight: 700,
                                    fontSize: 'var(--font-title-md)',
                                }}
                            >
                                {client.first_name} {client.last_name}
                            </span>
                        </div>
                        {/* Row 3: filter (esquerda) + seletor de data mais à direita */}
                        <div
                            style={{
                                // 3 colunas: filtro (auto) | espaçador (1fr) | seletor de mês (auto à direita)
                                display: 'grid',
                                gridTemplateColumns: 'auto 1fr auto',
                                alignItems: 'center',
                                columnGap: 8,
                                minWidth: 0,
                            }}
                        >
                            {/* Coluna esquerda: filtro */}
                            <div style={{ minWidth: 0, justifySelf: 'start' }}>
                                <select
                                    value={statusFilter}
                                    onChange={e =>
                                        setStatusFilter(
                                            e.target.value as StatusFilter,
                                        )
                                    }
                                    style={{
                                        fontSize: 'var(--font-body)',
                                        padding: '8px 10px',
                                        background: 'var(--color-pending-bg)',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: 6,
                                        color: 'var(--color-text)',
                                        fontWeight: 500,
                                        // Reduzido ~20% em relação ao ajuste atual; responsivo sem estourar
                                        width: 'clamp(144px, 100%, 192px)',
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
                                    <option value='canceled'>Cancelados</option>
                                </select>
                            </div>
                            {/* Coluna direita: setas + rótulo do mês/ano (alinhado à direita) */}
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    gap: 6,
                                    minWidth: 0,
                                    // posiciona este bloco na 3ª coluna (auto à direita)
                                    gridColumn: '3',
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
                                        // Permitir quebra em telas estreitas para não gerar overflow horizontal
                                        whiteSpace: 'normal',
                                        overflowWrap: 'anywhere',
                                        wordBreak: 'break-word',
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
                            {/* Coluna direita: espaçador flexível para manter centralização */}
                            <div style={{ minWidth: 0 }} />
                        </div>
                    </div>
                </div>

                {/* Content below sticky header */}
                {loading ? (
                    <div>Carregando…</div>
                ) : items.length === 0 ? (
                    <div>Nenhum compromisso neste mês.</div>
                ) : (
                    <div style={{ display: 'grid', gap: 12, paddingTop: 6 }}>
                        {Object.keys(groupedFiltered)
                            .sort()
                            .map(dayISO => {
                                // Importante: new Date('YYYY-MM-DD') é UTC. Use construtor local para rótulo correto.
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
                                        {groupedFiltered[dayISO].map(a => {
                                            const end = new Date(a.end_at);
                                            const isPending =
                                                a.status === 'scheduled' &&
                                                end < new Date();
                                            return (
                                                <div
                                                    key={a.id}
                                                    data-appt-id={a.id}
                                                    style={{
                                                        display: 'grid',
                                                        gridTemplateColumns:
                                                            '56px 1fr',
                                                        columnGap: 10,
                                                        alignItems:
                                                            'flex-start',
                                                        minWidth: 0,
                                                        width: '100%',
                                                    }}
                                                >
                                                    <TimeRangeLabel
                                                        start={a.start_at}
                                                        end={a.end_at}
                                                        size='md'
                                                    />
                                                    <div
                                                        style={{
                                                            minWidth: 0,
                                                            width: '100%',
                                                        }}
                                                    >
                                                        <AppointmentCard<Appointment>
                                                            appt={
                                                                a as Appointment
                                                            }
                                                            style={{
                                                                padding:
                                                                    '6px 8px',
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
                                                                a.status ===
                                                                'done'
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
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                    </div>
                )}
                {/* No error banner needed here; actions are non-destructive */}
                {pendingOpen && pendingAppt && (
                    <PendingActionsModal
                        open={pendingOpen}
                        onClose={() => {
                            setPendingOpen(false);
                            setPendingAppt(null);
                            setReloadKey(x => x + 1); // recarrega lista após ação
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
