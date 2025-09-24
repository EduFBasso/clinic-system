import React from 'react';
import StatusBadge from './StatusBadge';
import type { StatusKind } from './StatusBadge';
import TimeRangeLabel from './TimeRangeLabel';
import { FaRegFileAlt, FaEdit, FaBan } from 'react-icons/fa';
import { useServerTime } from '../../contexts/useServerTime'; // unified import path (no .js extension)

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

function deriveStatus(appt: SharedAppointmentLike, now: Date): StatusKind {
    const start = new Date(appt.start_at);
    const end = new Date(appt.end_at);
    if (appt.status === 'canceled') return 'canceled';
    if (appt.status === 'done') return 'done';
    if (start <= now && end > now) return 'ongoing';
    if (end < now && appt.status === 'scheduled') return 'past';
    return 'scheduled';
}

export function AppointmentCard<T extends SharedAppointmentLike>({
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
    // If a server-synced time is available, prefer it silently (invisible mitigation of client skew)
    const serverTime = useServerTime();
    const effectiveNow = serverTime?.effectiveNow ?? now;
    const status = deriveStatus(appt, effectiveNow);
    const start = new Date(appt.start_at);
    const end = new Date(appt.end_at);
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
    const isOngoing = status === 'ongoing';
    const canEdit = status === 'scheduled' && end > effectiveNow;
    const canCancel = status === 'scheduled' && end > effectiveNow;

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Left text cluster that can shrink & wrap */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: stackName ? 'flex-start' : 'center',
                        flexDirection: stackName ? 'column' : 'row',
                        gap: stackName ? 2 : 8,
                        flex: 1,
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
                            // Quando empilhado, manter nome em uma linha com elipse
                            whiteSpace: stackName ? 'nowrap' : 'normal',
                            overflow: stackName ? 'hidden' : 'visible',
                            textOverflow: stackName ? 'ellipsis' : 'clip',
                            minWidth: 0,
                            maxWidth: '100%',
                            overflowWrap: stackName ? 'normal' : 'anywhere',
                            wordBreak: stackName ? 'normal' : 'break-word',
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
                                overflowWrap: 'break-word',
                                wordBreak: 'normal',
                                whiteSpace: 'normal',
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
                        gap: 8,
                        flexShrink: 0,
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
                    {/* Optional edit/cancel action buttons */}
                    {onEdit && showEditAction && canEdit && (
                        <button
                            type='button'
                            title='Edit appointment'
                            onClick={e => {
                                e.stopPropagation();
                                if (canEdit) onEdit(appt);
                            }}
                            style={{
                                border: '1px solid var(--color-border)',
                                borderRadius: 6,
                                background: 'var(--color-bg)',
                                padding: 6,
                                cursor: 'pointer',
                            }}
                            disabled={!canEdit}
                        >
                            <FaEdit color={'var(--color-heading)'} />
                        </button>
                    )}
                    {onCancel && canCancel && (
                        <button
                            type='button'
                            title='Cancel appointment'
                            onClick={e => {
                                e.stopPropagation();
                                if (!canCancel) return;
                                const hh = (d: Date) =>
                                    `${String(d.getHours()).padStart(
                                        2,
                                        '0',
                                    )}:${String(d.getMinutes()).padStart(
                                        2,
                                        '0',
                                    )}`;
                                const msg = `Tem certeza que deseja cancelar o agendamento de ${hh(
                                    start,
                                )} - ${hh(end)}${
                                    clientName ? ' para ' + clientName : ''
                                }?`;
                                if (window.confirm(msg)) onCancel(appt);
                            }}
                            style={{
                                border: '1px solid var(--color-border)',
                                borderRadius: 6,
                                background: 'var(--color-danger-bg)',
                                padding: 6,
                                cursor: 'pointer',
                            }}
                            disabled={!canCancel}
                        >
                            <FaBan color={'var(--color-danger)'} />
                        </button>
                    )}
                    {(status === 'done' || status === 'canceled') &&
                        onDetails && (
                            <button
                                type='button'
                                title='Resumo da consulta'
                                aria-label='Resumo da consulta'
                                onClick={e => {
                                    e.stopPropagation();
                                    onDetails?.(appt);
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
                                }}
                            >
                                <FaRegFileAlt
                                    color={
                                        status === 'done'
                                            ? 'var(--color-done)'
                                            : 'var(--color-danger)'
                                    }
                                />
                            </button>
                        )}
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

export default AppointmentCard;
