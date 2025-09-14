// Isolado de React/hooks para evitar transformação SSR indesejada em testes.
// Definimos um tipo mínimo local para não depender de '../hooks/useAppointments'.
export interface AppointmentLike {
    id: number;
    start_at: string;
    end_at: string;
    status: 'scheduled' | 'done' | 'canceled';
    title?: string;
    visit_type?: string;
    notes?: string | null;
    [key: string]: unknown; // campos extras ignorados pela lógica
}

export interface NextAppointmentOptions {
    /** Treat an appointment whose start <= now < end as still upcoming (prioritize it). Default: true */
    includeOngoing?: boolean;
    /** Consider only appointments with status === 'scheduled'. Default: true */
    onlyScheduled?: boolean;
}

/** Returns the next relevant appointment after `now` (or ongoing) based on chronological order.
 * If none is found, returns null.
 */
export function getNextAppointment(
    appointments: AppointmentLike[] | undefined | null,
    now: Date = new Date(),
    opts: NextAppointmentOptions = {},
): AppointmentLike | null {
    if (!appointments || appointments.length === 0) return null;
    const { includeOngoing = true, onlyScheduled = true } = opts;
    const nowTime = now.getTime();

    const filtered = appointments.filter(a => {
        if (onlyScheduled && a.status !== 'scheduled') return false;
        const start = new Date(a.start_at).getTime();
        const end = new Date(a.end_at).getTime();
        const isOngoing = start <= nowTime && nowTime < end;
        if (isOngoing) return includeOngoing; // inclui somente se configurado
        // Não em andamento: considerar se ainda não terminou
        return end > nowTime;
    });
    if (filtered.length === 0) return null;

    // Sort by start time ascending
    filtered.sort(
        (a, b) =>
            new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    );

    // Among ongoing + future, we want the earliest that is not already finished
    return filtered[0] ?? null;
}

/** Utility to format a human helper label for display (e.g. "em 32 min", "agora", "há 5 min"). */
export function relativeLabel(
    appointment: AppointmentLike | null,
    now: Date = new Date(),
): string | null {
    if (!appointment) return null;
    const start = new Date(appointment.start_at).getTime();
    const end = new Date(appointment.end_at).getTime();
    const nowT = now.getTime();
    const diffStartMin = Math.round((start - nowT) / 60000);
    const diffEndMin = Math.round((nowT - end) / 60000);
    if (start <= nowT && nowT < end) return 'agora';
    if (diffStartMin > 0) return `em ${diffStartMin} min`;
    if (diffEndMin >= 0 && diffEndMin < 60)
        return `terminou há ${diffEndMin} min`;
    return null;
}
