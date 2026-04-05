import { useEffect, useState } from 'react';
import { API_BASE } from '../config/api';
import { isTokenExpired } from '../utils/jwt';
import type { Appointment } from './useAppointments';

/**
 * Single-sweep ongoing detector: performs ONE fetch for a small time window around now
 * and returns a Map<clientId, Appointment> for appointments that are currently ongoing.
 *
 * This avoids N-per-client requests and keeps the UI updated at a modest interval.
 */
/**
 * Singleton sweep manager (module-scoped): ensures only ONE polling loop runs,
 * regardless of how many components use the hook. It also pauses when the tab
 * is hidden to reduce background noise, and avoids unique URLs to let the
 * browser cache preflight responses.
 */
let sharedMap: Map<number, Appointment> = new Map();
let running = false;
let timer: number | null = null;
let abortCtl: AbortController | null = null;
const subs = new Set<() => void>();
let sweepIntervalMs: number | null = null;
let windowHalfMs: number | null = null;

function getIntervalMs() {
    if (sweepIntervalMs != null) return sweepIntervalMs;
    const raw = (import.meta as ImportMeta).env
        .VITE_ONGOING_SWEEP_INTERVAL_MS as string | undefined;
    const n = raw ? Number(raw) : NaN;
    sweepIntervalMs = Number.isFinite(n) && n >= 1000 ? n : 10_000; // default 10s
    return sweepIntervalMs;
}

function getWindowHalf(defaultWindowMs: number) {
    if (windowHalfMs != null) return windowHalfMs;
    windowHalfMs = Math.max(5_000, Math.floor(defaultWindowMs / 2));
    return windowHalfMs;
}

async function runSweep(defaultWindowMs: number) {
    try {
        const token = localStorage.getItem('accessToken') || '';
        if (!token || isTokenExpired(token)) {
            sharedMap = new Map();
            subs.forEach(fn => fn());
            return;
        }
        // Skip when document hidden to reduce noise
        try {
            if (
                typeof document !== 'undefined' &&
                document.visibilityState === 'hidden'
            ) {
                return;
            }
        } catch {
            /* ignore */
        }
        const nowMs = Date.now();
        const half = getWindowHalf(defaultWindowMs);
        const start = new Date(nowMs - half);
        const end = new Date(nowMs + half);
        const url = `${API_BASE}/agenda/appointments/?status=scheduled&start=${encodeURIComponent(
            start.toISOString(),
        )}&end=${encodeURIComponent(end.toISOString())}`; // restrict to scheduled to avoid canceled/done
        abortCtl = new AbortController();
        const r = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
            signal: abortCtl.signal,
        });
        if (!r.ok) return;
        const list: unknown = await r.json();
        const arr = (Array.isArray(list) ? list : []) as Array<
            Appointment & { status?: 'scheduled' | 'done' | 'canceled' }
        >;
        const m = new Map<number, Appointment>();
        for (const ap of arr) {
            if (ap.status && ap.status !== 'scheduled') {
                continue; // extra guard in case backend ignores the filter
            }
            const s = new Date(ap.start_at).getTime();
            const e = new Date(ap.end_at).getTime();
            if (
                Number.isFinite(s) &&
                Number.isFinite(e) &&
                s <= nowMs &&
                nowMs < e
            ) {
                m.set(ap.client, ap);
            }
        }
        sharedMap = m;
        subs.forEach(fn => fn());
    } catch {
        sharedMap = new Map();
        subs.forEach(fn => fn());
    }
}

function schedule(defaultWindowMs: number) {
    if (timer != null) window.clearTimeout(timer);
    const interval = getIntervalMs();
    timer = window.setTimeout(async () => {
        await runSweep(defaultWindowMs);
        if (running) schedule(defaultWindowMs);
    }, interval) as unknown as number;
}

function onVisibility() {
    try {
        if (document.visibilityState === 'visible') {
            void runSweep(windowHalfMs != null ? windowHalfMs * 2 : 60_000);
            if (!running)
                start(windowHalfMs != null ? windowHalfMs * 2 : 60_000);
        }
    } catch {
        /* ignore */
    }
}

function onAppointmentsChanged() {
    void runSweep(windowHalfMs != null ? windowHalfMs * 2 : 60_000);
}

function start(defaultWindowMs: number) {
    if (running) return;
    running = true;
    void runSweep(defaultWindowMs);
    schedule(defaultWindowMs);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener(
        'appointments:changed',
        onAppointmentsChanged as EventListener,
    );
}

function stop() {
    running = false;
    if (timer != null) window.clearTimeout(timer);
    timer = null;
    try {
        abortCtl?.abort();
    } catch {
        /* noop */
    }
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener(
        'appointments:changed',
        onAppointmentsChanged as EventListener,
    );
}

/**
 * Hook returning the current shared ongoing map (by clientId).
 * Multiple components can use it with ZERO extra network overhead.
 *
 * Params are kept for API stability; `now` is ignored by the singleton sweeper,
 * and `windowMs` defines the default half-window used by the sweeper.
 */
export function useOngoingSweep(_now?: Date, windowMs: number = 60_000) {
    const [, setVersion] = useState(0);

    useEffect(() => {
        const onUpdate = () => setVersion(v => (v + 1) % 1_000_000);
        subs.add(onUpdate);
        if (subs.size === 1) start(windowMs);

        return () => {
            subs.delete(onUpdate);
            if (subs.size === 0) stop();
        };
    }, [windowMs]);

    // Return the current shared map; local state change triggers re-render in consumers
    return sharedMap;
}
