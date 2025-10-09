import { useEffect, useState } from 'react';

/**
 * Unified useIsMobile hook.
 *
 * Semantics:
 * - Returns true when current viewport width <= breakpoint (default 900 to preserve existing layout behaviour).
 * - Uses window.innerWidth for broad compatibility + a resize listener (simpler & test friendly).
 * - Accepts custom breakpoint; callers relying on prior 600px variant can pass explicit value.
 *
 * Rationale for choosing innerWidth version over prior matchMedia variant:
 * - Existing production usage (components/useIsMobile.ts) used 900 default & innerWidth; avoiding a silent layout change.
 * - Keeps behaviour consistent across environments lacking full matchMedia mocks.
 */
export function useIsMobile(breakpoint = 900): boolean {
    const [isMobile, setIsMobile] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.innerWidth <= breakpoint;
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handler = () => setIsMobile(window.innerWidth <= breakpoint);
        // Initial sync
        handler();
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, [breakpoint]);

    return isMobile;
}

// Default export for backwards compatibility with previous default export usage.
export default useIsMobile;
