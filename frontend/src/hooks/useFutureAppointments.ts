import React from 'react';
import { fetchFutureAppointments } from '../services/appointments';
import { getMaxScheduledPerClient } from '../config/limits';

export function useFutureAppointments(
    clientId: number,
    startRefISO?: string | null,
    excludeAppointmentId?: number | null,
) {
    const [items, setItems] = React.useState<
        Array<{
            id: number;
            start_at: string;
            end_at: string;
            status: 'scheduled' | 'pending' | 'done' | 'canceled';
            title?: string;
            notes?: string;
        }>
    >([]);
    const [loading, setLoading] = React.useState(false);

    const dynLimit = getMaxScheduledPerClient();

    const totalScheduled = (startRefISO ? 1 : 0) + items.length;
    const limitReached = totalScheduled >= dynLimit;

    React.useEffect(() => {
        let cancelled = false;
        async function run() {
            if (!startRefISO) {
                setItems([]);
                return;
            }
            setLoading(true);
            try {
                const list = await fetchFutureAppointments(
                    clientId,
                    startRefISO,
                    excludeAppointmentId ?? null,
                    dynLimit + 5,
                );
                if (!cancelled) setItems(list);
            } catch {
                if (!cancelled) setItems([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        run();
        return () => {
            cancelled = true;
        };
    }, [clientId, startRefISO, excludeAppointmentId, dynLimit]);

    return { items, loading, dynLimit, totalScheduled, limitReached } as const;
}
