import React from 'react';
import StatusBadge from './StatusBadge';
// StatusKind is exported from StatusBadge; not needed explicitly here
import TimeRangeLabel from './TimeRangeLabel';
import { FaEdit, FaBan } from 'react-icons/fa';
import { useAppointmentCardState } from '../../hooks/useAppointmentCardState.ts';
import {
    getAppointmentOverride,
    subscribeOverrides,
} from '../../utils/appointments/overrides';
import {
    statusStripeColor,
    statusBackgroundColor,
} from '../../utils/appointments/status';

export interface SharedAppointmentLike {
    id: number;
    title?: string;
    start_at: string;
    end_at: string;
    status: 'scheduled' | 'done' | 'canceled' | 'ongoing';
    notes?: string;
    client_name?: string;
    client?: { id: number; name: string } | number;
}

export interface AppointmentCardProps<
    T extends SharedAppointmentLike = SharedAppointmentLike,
> {
    appt: T;
    // Tamanho lógico do cartão (ajusta tipografia via CSS vars). Largura/altura continuam fluindo pelo container/conteúdo.
    size?: 'sm' | 'md';
    onClick?: (appt: T) => void; // legacy primary click
    onUseTime?: (appt: T) => void; // alias for primary click (QuickSchedule)
    // Novo: permite que o cartão "Pendente" ative um fluxo de resolução (ex: PendingActionsModal)
    onResolvePending?: (appt: T) => void;
    onEdit?: (appt: T) => void;
    onCancel?: (appt: T) => void;
    onDetails?: (appt: T) => void;
    highlight?: boolean;
    editingActive?: boolean;
    pulse?: boolean;
    compact?: boolean;
    showNotes?: boolean;
    // Novo: seleção explícita (borda espessa verde)
    selected?: boolean;
    // Controla exibição do ícone de editar
    showEditAction?: boolean;
    // Controla exibição do horário no cartão
    showTime?: boolean;
    // Exibe o horário inline (HH:MM - HH:MM) na primeira linha em vez de bloco
    timeInline?: boolean;
    // Força layout com o NOME na primeira linha e o tipo de consulta abaixo
    stackName?: boolean;
    // Esconde o nome do cliente no cabeçalho e o exibe no rodapé (junto com notas)
    nameInFooter?: boolean;
    // Exibe uma linha de rodapé contendo Nome (forte) + Notas, mantendo cabeçalho focado no tipo
    showFooterLine?: boolean;
    className?: string;
    style?: React.CSSProperties;
    now?: Date;
}

function AppointmentCardViewInner<T extends SharedAppointmentLike>({
    appt,
    size = 'md',
    onClick,
    onUseTime,
    onResolvePending,
    onEdit,
    onCancel,
    onDetails,
    highlight,
    editingActive,
    pulse,
    compact,
    showNotes = true,
    selected = false,
    showEditAction = true,
    showTime = true,
    timeInline = false,
    stackName = false,
    nameInFooter = false,
    showFooterLine = false,
    className,
    style,
    now = new Date(),
}: AppointmentCardProps<T>) {
    // Apply ephemeral status override (e.g., optimistic 'done' after finalize)
    const [overrideStatus, setOverrideStatus] = React.useState<
        'scheduled' | 'done' | 'canceled' | undefined
    >(() => getAppointmentOverride(appt.id)?.status);
    React.useEffect(() => {
        setOverrideStatus(getAppointmentOverride(appt.id)?.status);
        const unsubscribe = subscribeOverrides(ids => {
            if (!ids || ids.includes(appt.id)) {
                setOverrideStatus(getAppointmentOverride(appt.id)?.status);
            }
        });
        return () => {
            try {
                unsubscribe();
            } catch {
                /* noop */
            }
        };
    }, [appt.id]);

    const apptWithOverride = React.useMemo(() => {
        return overrideStatus ? { ...appt, status: overrideStatus } : appt;
    }, [appt, overrideStatus]);

    const { status, canEdit, canCancel, isOngoing, start, end } =
        useAppointmentCardState(apptWithOverride, now);
    let clientName: string | undefined = (appt as SharedAppointmentLike)
        .client_name;
    if (
        (appt as SharedAppointmentLike).client &&
        typeof (appt as SharedAppointmentLike).client === 'object'
    ) {
        const c = (appt as SharedAppointmentLike).client as {
            id?: number;
            name?: string;
        };
        if (typeof c.name === 'string') clientName = c.name;
    }
    // Left color stripe by status, akin to QuickSchedule visuals
    const stripeColor = statusStripeColor(status);

    const isPending = status === 'past';
    // Overrides de tamanho via variáveis CSS locais
    const sizeVars: React.CSSProperties | undefined =
        size === 'sm'
            ? ((): React.CSSProperties => {
                  const vars: React.CSSProperties = {};
                  // reduções sutis para compactar tipografia
                  (vars as Record<string, string>)['--card-name-size'] = '14px';
                  (vars as Record<string, string>)['--card-type-size'] = '11px';
                  (vars as Record<string, string>)['--card-text-size'] = '11px';
                  return vars;
              })()
            : undefined;

    const base: React.CSSProperties = {
        border: selected
            ? '3px solid var(--color-success)'
            : '1px solid var(--color-border)',
        borderRadius: 'var(--card-radius)',
        padding: compact
            ? 'var(--card-padding-compact)'
            : 'var(--card-padding-md)',
        // Fundo claro conforme status para padronização visual
        background: statusBackgroundColor(status), // centralized mapping
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        fontFamily: 'var(--card-font-family)',
        cursor:
            isPending && onResolvePending
                ? 'pointer'
                : onClick || onUseTime
                ? 'pointer'
                : 'default',
        position: 'relative',
        maxWidth: '100%',
        // Avoid forcing GPU compositing to keep text rendering crisp on Windows
        boxShadow: editingActive
            ? pulse
                ? '0 0 0 1px var(--color-primary), 0 1px 3px rgba(0,0,0,0.08)'
                : '0 0 0 1px var(--color-primary), 0 1px 2px rgba(0,0,0,0.06)'
            : 'none',
        ...(highlight
            ? { outline: '2px solid var(--color-primary)', outlineOffset: 2 }
            : null),
        ...(sizeVars || {}),
        ...style,
    };
    // flags are derived by the shared hook

    return (
        <div
            id={`appt-card-${appt.id}`}
            data-appt-id={appt.id}
            className={className}
            style={base}
            onClick={() => {
                if (isOngoing) return; // bloquear interações em andamento
                if (isPending && onResolvePending) {
                    onResolvePending(appt);
                    return;
                }
                // Novo: para concluídos, o clique do cartão abre detalhes (ícone removido)
                if (onDetails && status === 'done') {
                    onDetails(appt);
                    return;
                }
                // Prioriza edição quando disponível
                if (onEdit) {
                    onEdit(appt);
                } else if (onUseTime) {
                    onUseTime(appt);
                } else if (onClick) {
                    onClick(appt);
                }
            }}
        >
            {/* Left status color stripe */}
            <div
                aria-hidden
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 5,
                    background: stripeColor,
                    borderTopLeftRadius: 8,
                    borderBottomLeftRadius: 8,
                }}
            />
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    columnGap: 8,
                    alignItems: 'center',
                    // Reserve a bit of vertical space to avoid micro layout shifts
                    minHeight: compact ? 20 : 24,
                }}
            >
                {/* Left: Client name (top-left) */}
                <div style={{ minWidth: 0 }}>
                    {!nameInFooter && (
                        <span
                            style={{
                                fontWeight: 'var(--card-name-weight)',
                                fontSize: 'var(--card-name-size)',
                                color: 'var(--color-heading)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                minWidth: 0,
                                maxWidth: '100%',
                                overflowWrap: 'normal',
                                wordBreak: 'normal',
                                display: 'block',
                            }}
                            title={clientName || 'Cliente'}
                        >
                            {clientName || 'Cliente'}
                        </span>
                    )}
                </div>
                {/* Right: Actions + Status badge, with visit type below status */}
                <span
                    style={{
                        marginLeft: 'auto',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        flexShrink: 0,
                        minHeight: 20,
                    }}
                >
                    {/* Always show time on non-compact cards for clarity (canceled/done included) */}
                    {!compact &&
                        showTime &&
                        (timeInline ? (
                            <span
                                style={{
                                    fontSize: 12,
                                    fontWeight: 'var(--card-time-weight)',
                                    color: 'var(--color-text)',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {new Date(appt.start_at).toLocaleTimeString(
                                    'pt-BR',
                                    { hour: '2-digit', minute: '2-digit' },
                                )}{' '}
                                –{' '}
                                {new Date(appt.end_at).toLocaleTimeString(
                                    'pt-BR',
                                    { hour: '2-digit', minute: '2-digit' },
                                )}
                            </span>
                        ) : (
                            <TimeRangeLabel
                                start={appt.start_at}
                                end={appt.end_at}
                                size='sm'
                            />
                        ))}
                    {/* Optional edit/cancel buttons (details icon removido; clique do cartão cobre 'done') */}
                    {(() => {
                        const showEdit = !!(
                            onEdit &&
                            showEditAction &&
                            canEdit
                        );
                        const showCancel = !!(onCancel && canCancel);
                        // Só preservar placeholders de layout quando for útil (cards não compactos, sem stack e com ações visíveis)
                        const preserveActionsLayout =
                            !compact && !stackName && showEditAction !== false;
                        const hiddenStyle: React.CSSProperties = {
                            visibility: 'hidden',
                            pointerEvents: 'none',
                        };
                        const maybeRender = (
                            shouldShow: boolean,
                            element: React.ReactNode,
                        ) => {
                            if (shouldShow) return element;
                            if (preserveActionsLayout) return element; // será estilizado como hidden no próprio botão
                            return null;
                        };
                        return (
                            <>
                                {maybeRender(
                                    showEdit,
                                    <button
                                        type='button'
                                        title='Edit appointment'
                                        onClick={e => {
                                            e.stopPropagation();
                                            if (showEdit && onEdit)
                                                onEdit(appt);
                                        }}
                                        style={{
                                            border: '1px solid var(--color-border)',
                                            borderRadius: 6,
                                            background: 'var(--color-bg)',
                                            padding: 6,
                                            cursor: 'pointer',
                                            ...(showEdit
                                                ? undefined
                                                : hiddenStyle),
                                        }}
                                        disabled={!showEdit}
                                        tabIndex={showEdit ? 0 : -1}
                                        aria-hidden={
                                            showEdit ? undefined : true
                                        }
                                    >
                                        <FaEdit
                                            color={'var(--color-heading)'}
                                        />
                                    </button>,
                                )}
                                {maybeRender(
                                    showCancel,
                                    <button
                                        type='button'
                                        title='Cancel appointment'
                                        onClick={e => {
                                            e.stopPropagation();
                                            if (!showCancel || !onCancel)
                                                return;
                                            const hh = (d: Date) =>
                                                `${String(
                                                    d.getHours(),
                                                ).padStart(2, '0')}:${String(
                                                    d.getMinutes(),
                                                ).padStart(2, '0')}`;
                                            const msg = `Tem certeza que deseja cancelar o agendamento de ${hh(
                                                start,
                                            )} - ${hh(end)}${
                                                clientName
                                                    ? ' para ' + clientName
                                                    : ''
                                            }?`;
                                            if (window.confirm(msg))
                                                onCancel(appt);
                                        }}
                                        style={{
                                            border: '1px solid var(--color-border)',
                                            borderRadius: 6,
                                            background:
                                                'var(--color-canceled-bg)',
                                            padding: 6,
                                            cursor: 'pointer',
                                            ...(showCancel
                                                ? undefined
                                                : hiddenStyle),
                                        }}
                                        disabled={!showCancel}
                                        tabIndex={showCancel ? 0 : -1}
                                        aria-hidden={
                                            showCancel ? undefined : true
                                        }
                                    >
                                        <FaBan
                                            color={'var(--color-canceled)'}
                                        />
                                    </button>,
                                )}
                            </>
                        );
                    })()}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                            minWidth: 0,
                        }}
                    >
                        <StatusBadge status={status} size='md' />
                        {!compact && (
                            <span
                                style={{
                                    fontSize: 'var(--card-type-size)',
                                    fontWeight: 'var(--card-type-weight)',
                                    color: 'var(--color-heading)',
                                    marginTop: 2,
                                    maxWidth: 160,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}
                                title={(() => {
                                    const vt = (
                                        appt as unknown as {
                                            visit_type?: string;
                                        }
                                    ).visit_type;
                                    const map: Record<string, string> = {
                                        avaliacao: 'Avaliação',
                                        retorno: 'Retorno',
                                        procedimento: 'Procedimento',
                                        outro: 'Outro',
                                        consulta: 'Consulta',
                                    };
                                    return (
                                        (vt && map[vt]) ||
                                        (appt as SharedAppointmentLike).title ||
                                        'Consulta'
                                    );
                                })()}
                            >
                                {(() => {
                                    const vt = (
                                        appt as unknown as {
                                            visit_type?: string;
                                        }
                                    ).visit_type;
                                    const map: Record<string, string> = {
                                        avaliacao: 'Avaliação',
                                        retorno: 'Retorno',
                                        procedimento: 'Procedimento',
                                        outro: 'Outro',
                                        consulta: 'Consulta',
                                    };
                                    return (
                                        (vt && map[vt]) ||
                                        (appt as SharedAppointmentLike).title ||
                                        'Consulta'
                                    );
                                })()}
                            </span>
                        )}
                    </div>
                </span>
            </div>
            {/* Footer line: Nome (forte) + Comentários na última linha */}
            {!compact && showFooterLine && (
                <div
                    style={{
                        display: 'flex',
                        gap: 6,
                        alignItems: 'baseline',
                        minWidth: 0,
                    }}
                >
                    <span
                        style={{
                            fontWeight: 800,
                            color: 'var(--color-heading)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '40%',
                        }}
                        title={clientName || 'Cliente'}
                    >
                        {clientName || 'Cliente'}
                    </span>
                    {appt.notes && (
                        <span
                            style={{
                                fontSize: 12,
                                color: 'var(--color-text)',
                                lineHeight: 1.3,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                minWidth: 0,
                                flex: 1,
                            }}
                            title={appt.notes}
                        >
                            {appt.notes}
                        </span>
                    )}
                </div>
            )}
            {/* Back-compat notes block when footer is not used */}
            {!compact && !showFooterLine && showNotes && appt.notes && (
                <div
                    style={{
                        fontSize: 'var(--card-text-size)',
                        color: 'var(--color-text)',
                        lineHeight: 1.3,
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                        minWidth: 0,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                    }}
                >
                    {appt.notes}
                </div>
            )}
            {/* Time range footer (optional) */}
            {compact && showTime && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <TimeRangeLabel
                        start={appt.start_at}
                        end={appt.end_at}
                        size='sm'
                    />
                </div>
            )}
        </div>
    );
}

// Memoized view to avoid unnecessary re-renders when props are stable
function areEqualShallow(
    prev: AppointmentCardProps<SharedAppointmentLike>,
    next: AppointmentCardProps<SharedAppointmentLike>,
) {
    const p = prev.appt;
    const n = next.appt;
    if (p.id !== n.id) return false;
    if (
        p.status !== n.status ||
        p.start_at !== n.start_at ||
        p.end_at !== n.end_at ||
        p.client_name !== n.client_name ||
        p.notes !== n.notes
    )
        return false;
    if (
        prev.highlight !== next.highlight ||
        prev.editingActive !== next.editingActive ||
        prev.pulse !== next.pulse ||
        prev.compact !== next.compact ||
        prev.showNotes !== next.showNotes ||
        prev.selected !== next.selected ||
        prev.showEditAction !== next.showEditAction ||
        prev.showTime !== next.showTime ||
        prev.timeInline !== next.timeInline ||
        prev.stackName !== next.stackName
    )
        return false;
    if (
        prev.onClick !== next.onClick ||
        prev.onUseTime !== next.onUseTime ||
        prev.onResolvePending !== next.onResolvePending ||
        prev.onEdit !== next.onEdit ||
        prev.onCancel !== next.onCancel ||
        prev.onDetails !== next.onDetails
    )
        return false;
    if (prev.className !== next.className) return false;
    if (prev.style !== next.style) return false;
    if (prev.now !== next.now) return false;
    return true;
}

const MemoizedAppointmentCardViewInner = React.memo(
    AppointmentCardViewInner as unknown as (
        props: AppointmentCardProps<SharedAppointmentLike>,
    ) => React.ReactElement,
    areEqualShallow,
) as unknown as <T extends SharedAppointmentLike>(
    props: AppointmentCardProps<T>,
) => React.ReactElement;

export function AppointmentCardView<T extends SharedAppointmentLike>(
    props: AppointmentCardProps<T>,
) {
    // Cast props to the base shape accepted by the memoized component
    return (
        <MemoizedAppointmentCardViewInner
            {...(props as unknown as AppointmentCardProps<SharedAppointmentLike>)}
        />
    );
}

export function AppointmentCardContainer<T extends SharedAppointmentLike>(
    props: AppointmentCardProps<T>,
) {
    // Simplificado: usar hora local do dispositivo (ou now passado por props)
    // Evitamos criar um "new Date()" a cada render para não invalidar a memoização do card.
    // Atualizamos o "agora" apenas uma vez por minuto (suficiente para fins de status: ongoing/past).
    function useNowTick(intervalMs: number) {
        const [now, setNow] = React.useState<Date>(() => new Date());
        React.useEffect(() => {
            // Atualiza no início do próximo minuto para alinhar os ticks
            const firstDelay = (() => {
                const d = new Date();
                const msToNextMinute =
                    60000 - (d.getSeconds() * 1000 + d.getMilliseconds());
                return Math.max(250, Math.min(msToNextMinute, 60000));
            })();
            let timer1: number | null = null;
            let timer2: number | null = null;
            timer1 = window.setTimeout(() => {
                setNow(new Date());
                // Depois, ticks fixos
                timer2 = window.setInterval(
                    () => setNow(new Date()),
                    intervalMs,
                ) as unknown as number;
            }, firstDelay) as unknown as number;
            return () => {
                if (timer1 != null)
                    window.clearTimeout(timer1 as unknown as number);
                if (timer2 != null)
                    window.clearInterval(timer2 as unknown as number);
            };
        }, [intervalMs]);
        return now;
    }

    const effectiveNow = React.useMemo(() => props.now, [props.now]);
    const tickNow = useNowTick(5000);
    // Se o chamador fornecer "now", usamos como autoridade. Caso contrário, usamos o relógio com tick por minuto.
    const finalNow = effectiveNow ?? tickNow;
    return <AppointmentCardView {...props} now={finalNow} />;
}

// Backwards-compatible default export
export default function AppointmentCard<T extends SharedAppointmentLike>(
    props: AppointmentCardProps<T>,
) {
    return <AppointmentCardContainer {...props} />;
}
