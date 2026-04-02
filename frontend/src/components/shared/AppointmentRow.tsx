import React from 'react';
import TimeRangeLabel from './TimeRangeLabel';
import AppointmentCard, {
    type AppointmentCardProps,
    type SharedAppointmentLike,
} from './AppointmentCard';

export interface AppointmentRowProps<T extends SharedAppointmentLike>
    extends Omit<AppointmentCardProps<T>, 'showTime'> {
    timeSize?: 'sm' | 'md';
    timeOrder?: 'start-top' | 'end-top';
    containerStyle?: React.CSSProperties;
    cardContainerStyle?: React.CSSProperties;
}

/**
 * Standard row layout for appointments: time on the left, minicard on the right.
 * Ensures consistent spacing, widths, and hides time inside the card.
 */
export default function AppointmentRow<T extends SharedAppointmentLike>(
    props: AppointmentRowProps<T>,
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
