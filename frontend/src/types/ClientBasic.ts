export interface ClientBasic {
    id: number;
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
    address?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    next_appointment_start_at?: string | null;
    next_appointment_end_at?: string | null; // Added for next appointment details
    next_appointment_title?: string | null;
    next_appointment_visit_type?:
        | 'avaliacao'
        | 'retorno'
        | 'procedimento'
        | 'outro'
        | null;
    next_appointment_notes?: string | null;
    next_appointment_status?: 'scheduled' | 'done' | 'canceled' | null;
    last_appointment_start_at?: string | null;
    last_appointment_title?: string | null;
    last_appointment_notes?: string | null;
    last_appointment_status?: 'scheduled' | 'done' | 'canceled' | null;
}
