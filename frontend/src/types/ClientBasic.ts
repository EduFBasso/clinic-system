export interface ClientBasic {
    id: number;
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
    // URL (absoluta ou relativa) da foto do cliente retornada pelo backend (campo ImageField). Pode ser null.
    photo?: string | null;
    address?: string;
    address_number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    date_of_birth?: string | null; // ISO yyyy-mm-dd
    next_appointment_start_at?: string | null;
    next_appointment_end_at?: string | null; // Added for next appointment details
    next_appointment_title?: string | null;
    next_appointment_visit_type?:
        | 'avaliacao'
        | 'retorno'
        | 'procedimento'
        | 'outro'
        | 'consulta'
        | null;
    next_appointment_notes?: string | null;
    next_appointment_status?: 'scheduled' | 'done' | 'canceled' | null;
    next_appointment_id?: number | null;
    last_appointment_start_at?: string | null;
    last_appointment_end_at?: string | null;
    last_appointment_title?: string | null;
    last_appointment_notes?: string | null;
    last_appointment_status?: 'scheduled' | 'done' | 'canceled' | null;
}
