import React from 'react';
import ClientCardRow from './ClientCardRow';
import type {
    AppointmentCardProps,
    SharedAppointmentLike,
} from './AppointmentCard';

export interface ClientDayListProps<T extends SharedAppointmentLike> {
    appointments: T[];
    // Optional filter/sort hooks to control which items render and order
    filterFn?: (a: T) => boolean;
    sortBy?: (a: T, b: T) => number; // default: start_at asc, then end_at asc

    // Visual options for the left time block and card
    timeSize?: 'sm' | 'md';
    timeOrder?: 'start-top' | 'end-top';
    cardSize?: 'sm' | 'md';

    // Per-item override of card props (e.g., highlight, editingActive, pulse, disabled actions)
    getCardProps?: (a: T) => Partial<AppointmentCardProps<T>> | undefined;

    // Event handlers forwarded to the card
    onClick?: (a: T) => void;
    onUseTime?: (a: T) => void;
    onResolvePending?: (a: T) => void;
    onEdit?: (a: T) => void;
    onCancel?: (a: T) => void;
    onDetails?: (a: T) => void;

    // Styling
    containerStyle?: React.CSSProperties; // wrapper for the whole list
    rowContainerStyle?: React.CSSProperties; // per-row grid wrapper (time + card)
    cardContainerStyle?: React.CSSProperties; // per-row card container style

    // Empty state placeholder
    emptyPlaceholder?: React.ReactNode;
}

export default function ClientDayList<T extends SharedAppointmentLike>(
    props: ClientDayListProps<T>,
) {
    const {
        appointments,
        filterFn,
        sortBy,
        timeSize = 'md',
        timeOrder,
        cardSize = 'md',
        getCardProps,
        onClick,
        onUseTime,
        onResolvePending,
        onEdit,
        onCancel,
        onDetails,
        containerStyle,
        rowContainerStyle,
        cardContainerStyle,
        emptyPlaceholder,
    } = props;

    const filtered = React.useMemo(() => {
        const base = filterFn ? appointments.filter(filterFn) : appointments;
        const cmp =
            sortBy ||
            ((a: T, b: T) =>
                new Date(a.start_at).getTime() -
                    new Date(b.start_at).getTime() ||
                new Date(a.end_at).getTime() - new Date(b.end_at).getTime());
        return base.slice().sort(cmp);
    }, [appointments, filterFn, sortBy]);

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                ...containerStyle,
            }}
        >
            {filtered.map(a => {
                const extra = (getCardProps && getCardProps(a)) || {};
                return (
                    <ClientCardRow<T>
                        key={a.id}
                        appt={a}
                        timeSize={timeSize}
                        timeOrder={timeOrder}
                        cardContainerStyle={cardContainerStyle}
                        containerStyle={rowContainerStyle}
                        // Forward base handlers; extra can override
                        onClick={onClick}
                        onUseTime={onUseTime}
                        onResolvePending={onResolvePending}
                        onEdit={onEdit}
                        onCancel={onCancel}
                        onDetails={onDetails}
                        size={cardSize}
                        {...(extra as Partial<AppointmentCardProps<T>>)}
                    />
                );
            })}
            {filtered.length === 0 && (emptyPlaceholder ?? null)}
        </div>
    );
}
