import React from 'react';
import StatusBadge from './StatusBadge';
// StatusKind is exported from StatusBadge; not needed explicitly here
import TimeRangeLabel from './TimeRangeLabel';
import { FaRegFileAlt, FaEdit, FaBan } from 'react-icons/fa';
import { useAppointmentCardState } from '../../hooks/useAppointmentCardState.ts';
import {
    getAppointmentOverride,
    subscribeOverrides,
} from '../../utils/appointments/overrides';

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
    className?: string;
    style?: React.CSSProperties;
    now?: Date;
}

function AppointmentCardViewInner<T extends SharedAppointmentLike>({
    appt,
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
    const stripeColor =
        status === 'canceled'
            ? 'var(--color-danger)'
            : status === 'ongoing'
            ? 'var(--color-ongoing)'
            : status === 'past'
            ? 'var(--color-pending)'
            : status === 'done'
            ? 'var(--color-done)'
            : 'var(--color-success)';

    const isPending = status === 'past';
    const base: React.CSSProperties = {
        border: selected
            ? '3px solid var(--color-success)'
            : '1px solid var(--color-border)',
        borderRadius: 8,
        padding: compact ? '6px 8px' : '8px 10px',
        // Fundo claro conforme status para padronização visual
        background:
            status === 'canceled'
                ? 'var(--color-danger-bg)'
                : status === 'ongoing'
                ? 'var(--color-ongoing-bg)'
                : status === 'past'
                ? 'var(--color-pending-bg)'
                : status === 'done'
                ? 'var(--color-done-bg)'
                : 'var(--color-success-bg)', // scheduled (ativo futuro)
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        cursor:
            isPending && onResolvePending
                ? 'pointer'
                : onClick || onUseTime
                ? 'pointer'
                : 'default',
        position: 'relative',
        maxWidth: '100%',
        // Hint compositor to keep this element on its own layer and reduce repaints
        willChange: 'transform',
        transform: 'translateZ(0)',
        boxShadow: editingActive
            ? pulse
                ? '0 0 0 1px var(--color-primary), 0 1px 3px rgba(0,0,0,0.08)'
                : '0 0 0 1px var(--color-primary), 0 1px 2px rgba(0,0,0,0.06)'
            : 'none',
        ...(highlight
            ? { outline: '2px solid var(--color-primary)', outlineOffset: 2 }
            : null),
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
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    // Reserve a bit of vertical space to avoid micro layout shifts
                    minHeight: compact ? 20 : 24,
                }}
            >
                {/* Left text cluster that can shrink & wrap */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: stackName ? 'flex-start' : 'center',
                        flexDirection: stackName ? 'column' : 'row',
                        gap: stackName ? 2 : 8,
                        flex: '1 1 auto',
                        minWidth: 0,
                    }}
                >
                    <span
                        style={{
                            fontWeight: 700,
                            fontSize: 15,
                            color:
                                status === 'canceled'
                                    ? 'var(--color-danger)'
                                    : status === 'done'
                                    ? 'var(--color-done)'
                                    : status === 'ongoing'
                                    ? 'var(--color-ongoing)'
                                    : status === 'past'
                                    ? 'var(--color-pending)'
                                    : 'var(--color-success-dark)',
                            // Sempre manter nome em uma linha com elipse
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            minWidth: 0,
                            maxWidth: '100%',
                            overflowWrap: 'normal',
                            wordBreak: 'normal',
                            // Permite que o nome ocupe o espaço livre do cluster esquerdo
                            flex: stackName ? '0 0 auto' : 1,
                            width: stackName ? '100%' : undefined,
                        }}
                        title={clientName || 'Cliente'}
                    >
                        {clientName || 'Cliente'}
                    </span>
                    {/* Visit type label: ao lado (padrão) ou abaixo do nome (stackName=true) */}
                    {!compact && (
                        <span
                            style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color:
                                    status === 'done'
                                        ? 'var(--color-done)'
                                        : 'var(--color-text)',
                                // Em layout empilhado, forçar quebra abaixo do nome e ocupar a largura toda
                                ...(stackName
                                    ? {
                                          display: 'block',
                                          width: '100%',
                                      }
                                    : {
                                          minWidth: 0,
                                          flexShrink: 1,
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                      }),
                            }}
                        >
                            {(() => {
                                const vt = (
                                    appt as unknown as { visit_type?: string }
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
                <span
                    style={{
                        marginLeft: 'auto',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        flexShrink: 0,
                        // Keep a stable block for right-side controls + badge
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
                                    fontWeight: 600,
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
                    {/* Optional edit/cancel/details action buttons: keep placeholders for stability */}
                    {(() => {
                        const showEdit = !!(
                            onEdit &&
                            showEditAction &&
                            canEdit
                        );
                        const showCancel = !!(onCancel && canCancel);
                        const showDetails = !!(
                            onDetails &&
                            (status === 'done' || status === 'canceled')
                        );
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
                                                'var(--color-danger-bg)',
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
                                        <FaBan color={'var(--color-danger)'} />
                                    </button>,
                                )}
                                {maybeRender(
                                    showDetails,
                                    <button
                                        type='button'
                                        title='Resumo da consulta'
                                        aria-label='Resumo da consulta'
                                        onClick={e => {
                                            e.stopPropagation();
                                            if (showDetails && onDetails)
                                                onDetails(appt);
                                        }}
                                        style={{
                                            border: '1px solid var(--color-border)',
                                            borderRadius: 6,
                                            background:
                                                status === 'done'
                                                    ? 'var(--color-done-bg)'
                                                    : 'var(--color-danger-bg)',
                                            padding: 6,
                                            cursor: 'pointer',
                                            ...(showDetails
                                                ? undefined
                                                : hiddenStyle),
                                        }}
                                        disabled={!showDetails}
                                        tabIndex={showDetails ? 0 : -1}
                                        aria-hidden={
                                            showDetails ? undefined : true
                                        }
                                    >
                                        <FaRegFileAlt
                                            color={
                                                status === 'done'
                                                    ? 'var(--color-done)'
                                                    : 'var(--color-danger)'
                                            }
                                        />
                                    </button>,
                                )}
                            </>
                        );
                    })()}
                    <StatusBadge status={status} size='md' />
                </span>
            </div>
            {!compact && showNotes && appt.notes && (
                <div
                    style={{
                        fontSize: 12,
                        color: 'var(--color-text)',
                        lineHeight: 1.3,
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                        // Prevent horizontal growth, allow wrapping and optionally clamp height
                        minWidth: 0,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 10, // generous cap; adjust per surface
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
