import { useEffect, useRef, useState } from 'react';

type Options = {
    enterDelayMs?: number; // delay before switching false -> true
    exitDelayMs?: number; // delay before switching true -> false
};

export function useHysteresisBoolean(value: boolean, opts: Options = {}) {
    const enterDelay = opts.enterDelayMs ?? 0;
    const exitDelay = opts.exitDelayMs ?? 0;
    const [stable, setStable] = useState<boolean>(value);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        // If already in desired state, nothing to do
        if (value === stable) return;

        // Clear any previous timer
        if (timerRef.current) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        const delay = value ? enterDelay : exitDelay;
        if (delay <= 0) {
            setStable(value);
            return;
        }
        timerRef.current = window.setTimeout(() => {
            setStable(value);
            timerRef.current = null;
        }, delay);

        return () => {
            if (timerRef.current) {
                window.clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [value, enterDelay, exitDelay, stable]);

    return stable;
}
