// Poll the server periodically only when likely ongoing appointments exist.
// Strategy:
// - While visible, every pollIntervalMs, dispatch a local event 'appointments:maybeRefresh'.
// - Components that already fetch (useClients/useAppointmentsRange) can listen to 'appointments:maybeRefresh'
//   and decide to refetch (or we can directly dispatch 'appointments:changed' to reuse handlers).
// - This keeps implementation simple and avoids wiring API here; we trigger existing refresh flows.

import { useEffect, useRef } from 'react';
import { dispatchers } from '../events/dispatchers';

type Options = {
    enabled: boolean;
    pollIntervalMs?: number; // default 30000
};

export function useAppointmentsLivePing({
    enabled,
    pollIntervalMs = 30000,
}: Options) {
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        function clear() {
            if (timerRef.current) {
                window.clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
        function start() {
            clear();
            timerRef.current = window.setInterval(() => {
                try {
                    // Trigger refresh — useClients and other consumers already listen to appointments:changed.
                    // updateClients is NOT dispatched here to avoid a redundant double-trigger in useClients.
                    dispatchers.appointmentsChanged();
                } catch {
                    /* noop */
                }
            }, pollIntervalMs);
        }

        if (!enabled) {
            clear();
            return;
        }

        const onVisibility = () => {
            if (document.hidden) clear();
            else start();
        };
        if (!document.hidden) start();
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            clear();
        };
    }, [enabled, pollIntervalMs]);
}
