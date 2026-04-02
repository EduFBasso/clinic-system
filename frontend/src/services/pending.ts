import { API_BASE } from '../config/api';
import type { Appointment } from '../hooks/useAppointments';
import type { SharedAppointmentLike } from '../components/shared/AppointmentCard';

export async function findFirstPendingForClient(
    clientId: number,
    now: Date,
): Promise<SharedAppointmentLike | null> {
    try {
        const token = localStorage.getItem('accessToken') || '';
        if (!token) return null;
        const url = `${API_BASE}/agenda/appointments/?client=${clientId}&status=scheduled&ordering=-end_at&limit=50&ts=${Date.now()}`;
        const r = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
        });
        if (!r.ok) return null;
        const data = (await r.json()) as Appointment[];
        if (!Array.isArray(data) || !data.length) return null;
        const nowMs = now.getTime();
        const pending = data.find(ap => {
            const endMs = new Date(ap.end_at).getTime();
            return (
                ap.status === 'scheduled' && isFinite(endMs) && endMs <= nowMs
            );
        });
        if (!pending) return null;
        const ap = pending;
        const clientIdResolved =
            typeof ap.client === 'number'
                ? ap.client
                : (ap.client && (ap.client as { id?: number }).id) || clientId;
        const appt: SharedAppointmentLike = {
            id: ap.id,
            start_at: ap.start_at,
            end_at: ap.end_at,
            status: 'scheduled',
            title: ap.title,
            notes: ap.notes,
            client: clientIdResolved,
            client_name: ap.client_name,
        };
        return appt;
    } catch {
        return null;
    }
}
