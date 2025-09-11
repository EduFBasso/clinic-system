export interface Appointment {
    id: number;
    client: number;
    professional: number;
    title?: string;
    start_at: string;
    end_at: string;
    status: 'scheduled' | 'done' | 'canceled';
    notes?: string;
    client_name?: string;
    professional_name?: string;
}

export function useAppointmentsRange(
    _start: Date,
    _end: Date,
    _clientId?: number,
) {
    void _start;
    void _end;
    void _clientId; // evita no-unused-vars
    return {
        items: [] as Appointment[],
        loading: false,
        error: null as string | null,
    };
}

export function useAppointments(_day: Date) {
    void _day; // evita no-unused-vars
    return { items: [] as Appointment[], loading: false };
}
