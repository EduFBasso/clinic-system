import type { Appointment } from '../../hooks/useAppointments';

export interface EnrichedAppointment extends Appointment {
    _start: Date;
    _end: Date;
    _isPast: boolean;
    _isOngoing: boolean;
    _derivedStatus: 'scheduled' | 'done' | 'canceled' | 'ongoing' | 'past';
}

export function enrichAppointment(
    appt: Appointment,
    now: Date = new Date(),
): EnrichedAppointment {
    const _start = new Date(appt.start_at);
    const _end = new Date(appt.end_at);
    const _isPast = _end < now;
    const _isOngoing =
        _start <= now && _end > now && appt.status === 'scheduled';
    let _derivedStatus: EnrichedAppointment['_derivedStatus'] = appt.status;
    if (_isOngoing) _derivedStatus = 'ongoing';
    else if (appt.status === 'scheduled' && _isPast) _derivedStatus = 'past';
    return { ...appt, _start, _end, _isPast, _isOngoing, _derivedStatus };
}

export function enrichList(
    list: Appointment[],
    now: Date = new Date(),
): EnrichedAppointment[] {
    return list.map(a => enrichAppointment(a, now));
}

export function groupByDay(
    list: EnrichedAppointment[],
): Record<string, EnrichedAppointment[]> {
    return list.reduce((acc, a) => {
        const d = a._start.toISOString().slice(0, 10);
        (acc[d] = acc[d] || []).push(a);
        return acc;
    }, {} as Record<string, EnrichedAppointment[]>);
}
