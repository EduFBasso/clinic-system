export type AppointmentStatus = 'scheduled' | 'done' | 'canceled';

export interface ClientBasic {
    id: number;
    first_name: string;
    last_name: string;
    phone?: string;
    email: string;
    address?: string;
    neighborhood?: string;
    city?: string;
    state?: string;

    // Informações expostas pelo backend sobre o próximo agendamento (opcionais)
    next_appointment_title?: string | null;
    next_appointment_notes?: string | null;
    next_appointment_status?: AppointmentStatus | null;
    next_appointment_start_at?: string | null; // ISO
    next_appointment_end_at?: string | null; // ISO
}
