// Lightweight ticking hook for time-based UI states.
// - Ticks every "intervalMs" when the page is visible.
// - Pauses when the tab is hidden (Page Visibility API) to be battery-friendly.
// - Returns a Date instance that updates on each tick.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getNow } from '../utils/now';

export function useNow(intervalMs = 30000) {
    const [now, setNow] = useState<Date>(getNow());
    const timerRef = useRef<number | null>(null);

    const clear = useCallback(() => {
        if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const start = useCallback(() => {
        clear();
        timerRef.current = window.setInterval(
            () => setNow(getNow()),
            intervalMs,
        );
    }, [clear, intervalMs]);

    useEffect(() => {
        const onVisibility = () => {
            if (document.hidden) {
                clear();
            } else {
                setNow(getNow());
                start();
            }
        };
        // Start immediately if visible
        if (!document.hidden) start();
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            clear();
        };
    }, [start, clear]);

    return now;
}
