import { useEffect, useRef, useState } from 'react';

/**
 * Returns a boolean flag that stays true for a short period after the page
 * becomes visible again (e.g., after iOS background resume). Useful to avoid
 * aggressive cleanups based only on local time jumps.
 */
export function useVisibilityResumeGrace(windowMs: number = 30_000) {
    const [active, setActive] = useState(false);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        function arm() {
            try {
                if (document.visibilityState === 'visible') {
                    setActive(true);
                    if (timerRef.current != null)
                        window.clearTimeout(timerRef.current);
                    timerRef.current = window.setTimeout(() => {
                        setActive(false);
                    }, windowMs) as unknown as number;
                }
            } catch {
                /* noop */
            }
        }
        const onVisibility = () => arm();
        const onPageShow = () => arm();
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('pageshow', onPageShow as EventListener);
        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('pageshow', onPageShow as EventListener);
            if (timerRef.current != null) window.clearTimeout(timerRef.current);
        };
    }, [windowMs]);

    return active;
}
