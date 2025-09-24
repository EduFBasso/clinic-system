import React, { useEffect, useRef, useState } from 'react';
import { Ctx } from './ServerTimeCore';
import type { ServerTimeContextValue } from './ServerTimeCore';

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

interface ProviderProps {
    children: React.ReactNode;
    /** For tests: override offset directly, skip fetch */
    fixedOffsetMs?: number;
    /** Disable network fetch (used with fixedOffsetMs) */
    disableFetch?: boolean;
    /** Poll interval ms to advance effectiveNow; default 1000 */
    tickMs?: number;
}

export function ServerTimeProvider({
    children,
    fixedOffsetMs,
    disableFetch,
    tickMs = 1000,
}: ProviderProps) {
    const [offsetMs, setOffsetMs] = useState<number>(fixedOffsetMs ?? 0);
    const [ready, setReady] = useState<boolean>(!!fixedOffsetMs || false);
    const [, forceRender] = useState(0); // to update effectiveNow each tick
    const lastSyncRef = useRef<number | null>(null);

    // Initial sync (unless fixed offset provided)
    useEffect(() => {
        if (fixedOffsetMs != null) {
            setReady(true);
            return;
        }
        if (disableFetch) {
            setReady(true);
            return;
        }
        let cancelled = false;
        async function sync() {
            try {
                const started = Date.now();
                const res = await fetch('/health/full', { cache: 'no-store' });
                if (!res.ok) throw new Error('non-200');
                const json = await res.json();
                // json.time ISO string from backend
                if (json && typeof json.time === 'string') {
                    const serverTime = new Date(json.time).getTime();
                    const rtt = Date.now() - started; // naive
                    // Approximate midpoint to reduce latency skew
                    const clientMid = started + rtt / 2;
                    const newOffset = serverTime - clientMid;
                    if (!cancelled) {
                        setOffsetMs(newOffset);
                        lastSyncRef.current = Date.now();
                    }
                }
            } catch {
                // swallow; offset remains 0
            } finally {
                if (!cancelled) setReady(true);
            }
        }
        sync();
        return () => {
            cancelled = true;
        };
    }, [fixedOffsetMs, disableFetch]);

    // Ticker to advance time without causing reflows everywhere; consumer derives Date each render.
    useEffect(() => {
        const id = setInterval(() => forceRender(x => x + 1), tickMs);
        return () => clearInterval(id);
    }, [tickMs]);

    const value: ServerTimeContextValue = {
        effectiveNow: new Date(Date.now() + offsetMs),
        offsetMs,
        ready,
        resync: () => {
            if (fixedOffsetMs != null || disableFetch) return; // ignore
            // Fire-and-forget re-sync; keep logic minimal
            (async () => {
                try {
                    const started = Date.now();
                    const res = await fetch('/health/full', {
                        cache: 'no-store',
                    });
                    if (!res.ok) return;
                    const json = await res.json();
                    if (json && typeof json.time === 'string') {
                        const serverTime = new Date(json.time).getTime();
                        const rtt = Date.now() - started;
                        const clientMid = started + rtt / 2;
                        setOffsetMs(serverTime - clientMid);
                        lastSyncRef.current = Date.now();
                    }
                } catch {
                    /* noop */
                }
            })();
        },
    };

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
