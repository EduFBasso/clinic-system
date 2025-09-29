import { useEffect, useState } from 'react'; // simplified modern-only implementation

/**
 * useIsMobile: retorna true quando viewport <= breakpoint px (default 600).
 * Usa matchMedia para atualizar reativamente.
 */
export function useIsMobile(breakpoint = 600) {
    const query = `(max-width: ${breakpoint}px)`;
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined'
            ? window.matchMedia(query).matches
            : false,
    );

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mql = window.matchMedia(query);
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        // Add initial just in case
        setIsMobile(mql.matches);
        mql.addEventListener('change', handler);
        return () => {
            mql.removeEventListener('change', handler);
        };
    }, [query]);

    return isMobile;
}
