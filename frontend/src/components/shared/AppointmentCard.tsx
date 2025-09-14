import React from 'react';
import StatusBadge from './StatusBadge';
import type { StatusKind } from './StatusBadge';
import TimeRangeLabel from './TimeRangeLabel';

export interface SharedAppointmentLike {
    id: number;
    title?: string;
    start_at: string;
    end_at: string;
    status: 'scheduled' | 'done' | 'canceled';
    notes?: string;
    client_name?: string;
    client?: { id: number; name: string } | number;
}

export interface AppointmentCardProps {
    appt: SharedAppointmentLike;
    onClick?: (appt: SharedAppointmentLike) => void;
    highlight?: boolean;
    compact?: boolean;
    showNotes?: boolean;
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

export const AppointmentCard: React.FC<AppointmentCardProps> = ({
    appt,
    onClick,
    highlight,
    compact,
    showNotes = true,
    className,
    style,
    now = new Date(),
}) => {
    const status = deriveStatus(appt, now);
    let clientName: string | undefined = appt.client_name;
    if (appt.client && typeof appt.client === 'object') {
        const c = appt.client as { id?: number; name?: string };
        if (typeof c.name === 'string') clientName = c.name;
    }
    const base: React.CSSProperties = {
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: compact ? '6px 8px' : '8px 10px',
        background: 'var(--card-bg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        cursor: onClick ? 'pointer' : 'default',
        ...(highlight
            ? { outline: '2px solid var(--color-primary)', outlineOffset: 2 }
            : null),
        ...style,
    };
    return (
        <div className={className} style={base} onClick={() => onClick?.(appt)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                    style={{
                        fontWeight: 700,
                        fontSize: 15,
                        color: status === 'canceled' ? '#b91c1c' : '#065f46',
                    }}
                >
                    {clientName || 'Cliente'}
                </span>
                {!compact && (
                    <span
                        style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: '#374151',
                        }}
                    >
                        {appt.title || 'Consulta'}
                    </span>
                )}
                <span style={{ marginLeft: 'auto' }}>
                    <StatusBadge status={status} size='md' />
                </span>
            </div>
            {!compact && showNotes && appt.notes && (
                <div
                    style={{
                        fontSize: 12,
                        color: '#374151',
                        lineHeight: 1.3,
                        maxHeight: 34,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}
                >
                    {appt.notes}
                </div>
            )}
            {/* Time range footer (optional) */}
            {compact && (
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
};

export default AppointmentCard;
