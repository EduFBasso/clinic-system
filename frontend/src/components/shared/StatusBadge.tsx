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
    past: 'Pendente',
};

function color(status: StatusKind) {
    switch (status) {
        case 'canceled':
            return 'var(--color-danger)';
        case 'ongoing':
            // Unify ongoing visuals using token
            return 'var(--color-ongoing)';
        case 'done':
            return 'var(--color-done)';
        case 'past':
            // Pending should use tokenized grey
            return 'var(--color-pending)';
        case 'scheduled':
        default:
            return 'var(--color-success)';
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
