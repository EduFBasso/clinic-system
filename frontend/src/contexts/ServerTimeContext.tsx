import React from 'react';

/**
 * Provides a monotonic-ish server-corrected current Date, mitigating client clock skew.
 * Simplest approach: fetch /health/full once, compute offsetMs = serverTime - clientNow.
 * Then expose effectiveNow = new Date(Date.now() + offsetMs) and update every second.
 * If the fetch fails, offsetMs = 0 (graceful degradation).
 * No user-facing banner (design decision: keep invisible; domain tolerates small drift).
 *
 * For tests we allow injecting a fixedOffsetMs to simulate skew without network.
 */
// NOTE: Types & hook moved to separate file to appease React Fast Refresh rule
// which warns when a TSX file mixes component + non-component exports.
// Keeping context creation here; the hook simply re-exports useContext(Ctx).
// ServerTimeContextValue & Ctx imported from ServerTimeCore to keep this file component-only for Fast Refresh.

// Accept legacy props to remain backward compatible with old tests/usages.
// They are ignored in this simplified provider.
interface ProviderProps {
    children: React.ReactNode;
    fixedOffsetMs?: number;
    disableFetch?: boolean;
}

export function ServerTimeProvider({ children }: ProviderProps) {
    // No-op provider kept for backward compatibility; new code does not rely on server time.
    return <>{children}</>;
}
