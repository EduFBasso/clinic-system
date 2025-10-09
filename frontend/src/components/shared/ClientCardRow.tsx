import React from 'react';
import TimeRangeLabel from './TimeRangeLabel';
import AppointmentCard, {
    type AppointmentCardProps,
    type SharedAppointmentLike,
} from './AppointmentCard';

export interface ClientCardRowProps<T extends SharedAppointmentLike>
    extends Omit<AppointmentCardProps<T>, 'showTime'> {
    timeSize?: 'sm' | 'md';
    timeOrder?: 'start-top' | 'end-top';
    containerStyle?: React.CSSProperties;
    cardContainerStyle?: React.CSSProperties;
}

/**
 * High-level row wrapper that always renders time on the left and the centralized AppointmentCard on the right.
 * Keeps handler mapping inside the card (onResolvePending/onEdit/onUseTime/onClick) consistent across surfaces.
 */
export default function ClientCardRow<T extends SharedAppointmentLike>(
    props: ClientCardRowProps<T>,
) {
    const {
        appt,
        timeSize = 'md',
        containerStyle,
        cardContainerStyle,
        ...card
    } = props;
    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: '56px 1fr',
                columnGap: 10,
                alignItems: 'flex-start',
                minWidth: 0,
                width: '100%',
                ...containerStyle,
            }}
        >
            <TimeRangeLabel
                start={appt.start_at}
                end={appt.end_at}
                size={timeSize}
                order={props.timeOrder}
            />
            <div style={{ minWidth: 0, width: '100%', ...cardContainerStyle }}>
                <AppointmentCard
                    {...(card as AppointmentCardProps<T>)}
                    appt={appt}
                    showTime={false}
                />
            </div>
        </div>
    );
}
