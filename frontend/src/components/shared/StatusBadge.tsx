import React from 'react';

export type StatusKind = 'scheduled' | 'done' | 'canceled' | 'ongoing' | 'past';

export interface StatusBadgeProps {
    status: StatusKind;
    size?: 'sm' | 'md';
    className?: string;
    style?: React.CSSProperties;
    labelOverride?: string;
}

const LABELS: Record<StatusKind, string> = {
    scheduled: 'Ativo',
    done: 'Concluído',
    canceled: 'Cancelado',
    ongoing: 'Em andamento',
    past: 'Vencido',
};

function color(status: StatusKind) {
    switch (status) {
        case 'canceled':
            return '#b91c1c';
        case 'ongoing':
            return '#2563eb';
        case 'done':
            return '#6b7280';
        case 'past':
            return '#92400e';
        case 'scheduled':
        default:
            return '#047857';
    }
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
    status,
    size = 'sm',
    className,
    style,
    labelOverride,
}) => {
    const bg = color(status);
    const fontSize = size === 'md' ? 11 : 10;
    return (
        <span
            className={className}
            style={{
                fontSize,
                background: bg,
                color: 'white',
                padding: '2px 6px',
                borderRadius: 4,
                fontWeight: 600,
                ...style,
            }}
        >
            {labelOverride || LABELS[status] || status}
        </span>
    );
};

export default StatusBadge;
