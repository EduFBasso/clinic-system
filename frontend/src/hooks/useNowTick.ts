import React from 'react';

/**
 * Returns a reactive `Date` that updates every `intervalMs` milliseconds.
 * Aligns the first tick to the next multiple of the interval to smooth
 * status transitions (e.g. scheduled → ongoing on the minute boundary).
 *
 * @param intervalMs - tick interval in ms (default: 30 000 = 30 s)
 */
export function useNowTick(intervalMs = 30_000): Date {
    const [now, setNow] = React.useState(() => new Date());
    React.useEffect(() => {
        // Align first tick to the next multiple of the interval
        const firstDelay = (() => {
            const d = new Date();
            const ms = d.getMilliseconds() + d.getSeconds() * 1000;
            const rem = intervalMs - (ms % intervalMs);
            return Math.max(250, Math.min(rem, intervalMs));
        })();
        let t1: ReturnType<typeof window.setTimeout> | null = null;
        let t2: ReturnType<typeof window.setInterval> | null = null;
        t1 = window.setTimeout(() => {
            setNow(new Date());
            t2 = window.setInterval(() => setNow(new Date()), intervalMs);
        }, firstDelay);
        return () => {
            if (t1 != null) window.clearTimeout(t1);
            if (t2 != null) window.clearInterval(t2);
        };
    }, [intervalMs]);
    return now;
}
