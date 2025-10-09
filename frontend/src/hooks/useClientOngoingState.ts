import React from 'react';
import type { Appointment } from './useAppointments';
import type { ClientBasic } from '../types/ClientBasic';
import { useOngoingSnapshot } from './useOngoingSnapshot';
import { useOngoingSweep } from './useOngoingSweep';
import { useOngoingLatch, readOngoingLatch } from './useOngoingLatch';
import { getAppointmentOverride } from '../utils/appointments/overrides';
import { useAppointmentCardState } from './useAppointmentCardState.ts';
import { track } from '../utils/telemetry';
import { API_BASE } from '../config/api';

interface Params {
    client: ClientBasic;
    now: Date;
    enableProbe: boolean; // mirrors ENABLE_ONGOING_PROBE flag
    debug?: boolean;
    // (reserved for future use) resumeGraceMs?: number;
}

export interface UseClientOngoingStateResult {
    isOngoing: boolean;
    isOngoingRaw: boolean;
    displayStartISO: string | null;
    displayEndISO: string | null;
    effectiveApptId: number | null;
    suppress(ms: number): void;
    afterFinalizeSuccess(): void; // hook to be called after finalize action succeds
    hasTrustedWindow: boolean;
    latchedId: number | null;
}

/**
 * Consolidates all the complex heuristics around detecting and maintaining the
 * "ongoing" visual/behavioral state for a ClientCard. This was extracted from
 * ClientCard.tsx to reduce cognitive load there.
 */
export function useClientOngoingState({
    client,
    now,
    enableProbe,
    debug = false,
}: // resumeGraceMs not currently used; kept for future adaptive grace logic
Params): UseClientOngoingStateResult {
    const isScheduled = client.next_appointment_status === 'scheduled';
    const startISO = client.next_appointment_start_at ?? null;
    const endISO = client.next_appointment_end_at ?? null;

    // Snapshot keeps scheduled window briefly resilient to backend hiccups
    const { snapshot } = useOngoingSnapshot({
        clientId: client.id,
        startAt: startISO,
        endAt: endISO,
        serverIsScheduled: isScheduled,
        now,
        graceMs: 0,
        useSnapshotWhenServerNotScheduled: false,
    });

    // Global sweep result (batched fetch outside this component tree)
    const sweepByClient = useOngoingSweep(now, 2 * 60 * 60 * 1000);

    const [overrideOngoing, setOverrideOngoing] =
        React.useState<Appointment | null>(null);
    const [suppressUntil, setSuppressUntil] = React.useState(0);

    // Latch (persist style even if server window flickers) + storage refresh on visibility
    const {
        latched,
        setLatched,
        clear: clearLatch,
    } = useOngoingLatch(client.id);

    // Visibility resume-check: refresh from storage when tab becomes visible again
    React.useEffect(() => {
        function refreshFromStorage() {
            try {
                const snap = readOngoingLatch(client.id);
                if (snap) {
                    setLatched({
                        id: snap.id,
                        startAt: snap.startAt,
                        endAt: snap.endAt,
                    });
                }
            } catch {
                /* noop */
            }
        }
        document.addEventListener('visibilitychange', refreshFromStorage);
        window.addEventListener(
            'pageshow',
            refreshFromStorage as EventListener,
        );
        return () => {
            document.removeEventListener(
                'visibilitychange',
                refreshFromStorage,
            );
            window.removeEventListener(
                'pageshow',
                refreshFromStorage as EventListener,
            );
        };
    }, [client.id, setLatched]);

    // Probe logic: either rely on sweep or perform per-client probe when flag enabled
    React.useEffect(() => {
        let cancelled = false;
        if (!enableProbe) {
            const ap = sweepByClient.get(client.id) || null;
            setOverrideOngoing(ap);
            return () => {
                cancelled = true;
            };
        }
        async function probe() {
            if (isScheduled) {
                setOverrideOngoing(null);
                return;
            }
            try {
                const token = localStorage.getItem('accessToken') || '';
                if (!token) return;
                const nowMs = now.getTime();
                const start = new Date(nowMs - 120 * 60 * 1000);
                const end = new Date(nowMs + 30 * 60 * 1000);
                const url = `${API_BASE}/agenda/appointments/?client=${
                    client.id
                }&start=${encodeURIComponent(
                    start.toISOString(),
                )}&end=${encodeURIComponent(
                    end.toISOString(),
                )}&ts=${Date.now()}`;
                const ac = new AbortController();
                const r = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: 'no-store',
                    signal: ac.signal,
                });
                const data = (await r.json()) as Appointment[];
                if (!cancelled) {
                    if (!Array.isArray(data) || !data.length) {
                        setOverrideOngoing(null);
                    } else {
                        const inWin = data.find(ap => {
                            const s = new Date(ap.start_at).getTime();
                            const e = new Date(ap.end_at).getTime();
                            return (
                                isFinite(s) &&
                                isFinite(e) &&
                                s <= nowMs &&
                                nowMs < e
                            );
                        });
                        setOverrideOngoing(inWin ?? null);
                    }
                }
                return () => ac.abort();
            } catch {
                if (!cancelled) setOverrideOngoing(null);
            }
        }
        const cleanup = probe();
        return () => {
            cancelled = true;
            try {
                const fn = cleanup as unknown;
                if (typeof fn === 'function') (fn as () => void)();
            } catch {
                /* noop */
            }
        };
    }, [client.id, isScheduled, now, enableProbe, sweepByClient]);

    const windowFromServer = !!(isScheduled && startISO && endISO);
    const windowFromOverride = React.useMemo(() => {
        if (!overrideOngoing) return false;
        const s = new Date(overrideOngoing.start_at).getTime();
        const e = new Date(overrideOngoing.end_at).getTime();
        const t = now.getTime();
        return isFinite(s) && isFinite(e) && s <= t && t < e;
    }, [overrideOngoing, now]);
    const hasTrustedWindow = windowFromServer || windowFromOverride;

    const baseDisplayStartISO = React.useMemo(() => {
        if (windowFromOverride && overrideOngoing?.start_at)
            return overrideOngoing.start_at;
        if (startISO) return startISO;
        return snapshot?.startAt ?? null;
    }, [
        windowFromOverride,
        overrideOngoing?.start_at,
        startISO,
        snapshot?.startAt,
    ]);
    const baseDisplayEndISO = React.useMemo(() => {
        if (windowFromOverride && overrideOngoing?.end_at)
            return overrideOngoing.end_at;
        if (endISO) return endISO;
        return snapshot?.endAt ?? null;
    }, [windowFromOverride, overrideOngoing?.end_at, endISO, snapshot?.endAt]);
    const baseEffectiveApptId = React.useMemo(() => {
        if (windowFromOverride && overrideOngoing?.id)
            return overrideOngoing.id;
        if (client.next_appointment_id != null)
            return client.next_appointment_id;
        return null;
    }, [windowFromOverride, overrideOngoing?.id, client.next_appointment_id]);

    const effectiveApptId = React.useMemo(() => {
        if (baseEffectiveApptId != null) return baseEffectiveApptId;
        return latched?.id ?? null;
    }, [baseEffectiveApptId, latched?.id]);

    // Display window prefers latched while valid
    const latchedValid = React.useMemo(() => {
        if (!latched) return false;
        const endMs = new Date(latched.endAt).getTime();
        if (!isFinite(endMs)) return false;
        const nowMs = now.getTime();
        const GRACE_MS = 90 * 1000;
        return nowMs < endMs + GRACE_MS;
    }, [latched, now]);

    const displayStartISO = React.useMemo(() => {
        if (latched && latchedValid && effectiveApptId === latched.id)
            return latched.startAt;
        return baseDisplayStartISO;
    }, [latched, latchedValid, effectiveApptId, baseDisplayStartISO]);
    const displayEndISO = React.useMemo(() => {
        if (latched && latchedValid && effectiveApptId === latched.id)
            return latched.endAt;
        return baseDisplayEndISO;
    }, [latched, latchedValid, effectiveApptId, baseDisplayEndISO]);

    const apptLike = React.useMemo(
        () => ({
            start_at: displayStartISO || new Date(0).toISOString(),
            end_at: displayEndISO || new Date(0).toISOString(),
            status: 'scheduled' as const,
        }),
        [displayStartISO, displayEndISO],
    );
    const apptState = useAppointmentCardState(apptLike, now);

    const isOngoingRaw = React.useMemo(() => {
        const t = now.getTime();
        if (suppressUntil > t) return false;
        if (
            latchedValid &&
            latched &&
            (!baseEffectiveApptId || latched.id === effectiveApptId)
        )
            return true;
        return hasTrustedWindow ? apptState.isOngoing : false;
    }, [
        suppressUntil,
        latchedValid,
        latched,
        baseEffectiveApptId,
        effectiveApptId,
        hasTrustedWindow,
        apptState,
        now,
    ]);

    // Simple hysteresis: enter delay 500ms, immediate exit
    const [isOngoing, setIsOngoing] = React.useState(false);
    const prevRawRef = React.useRef(false);
    React.useEffect(() => {
        if (isOngoingRaw && !prevRawRef.current) {
            const t = window.setTimeout(() => setIsOngoing(true), 500);
            return () => window.clearTimeout(t);
        } else if (!isOngoingRaw) {
            setIsOngoing(false);
        }
        prevRawRef.current = isOngoingRaw;
    }, [isOngoingRaw]);

    // Telemetry + latch enter
    const prevOngoingRef = React.useRef(false);
    React.useEffect(() => {
        if (
            !prevOngoingRef.current &&
            isOngoing &&
            effectiveApptId &&
            displayStartISO
        ) {
            const suppressKey = `client:ongoing:suppress:${client.id}`;
            const isSuppressed = !!localStorage.getItem(suppressKey);
            track({
                type: 'appointment_entered_ongoing',
                payload: {
                    id: effectiveApptId,
                    start_at: displayStartISO,
                    client_id: client.id,
                },
            });
            if (
                !isSuppressed &&
                hasTrustedWindow &&
                baseDisplayStartISO &&
                baseDisplayEndISO
            ) {
                setLatched({
                    id: effectiveApptId,
                    startAt: baseDisplayStartISO!,
                    endAt: baseDisplayEndISO!,
                });
            }
            try {
                window.dispatchEvent(
                    new CustomEvent('scrollToClientCard', {
                        detail: { clientId: client.id },
                    }),
                );
            } catch {
                /* noop */
            }
        }
        prevOngoingRef.current = isOngoing;
    }, [
        isOngoing,
        effectiveApptId,
        displayStartISO,
        client.id,
        hasTrustedWindow,
        baseDisplayStartISO,
        baseDisplayEndISO,
        setLatched,
    ]);

    // Auto clear latch some time after end
    React.useEffect(() => {
        if (!latched) return;
        const endMs = new Date(latched.endAt).getTime();
        if (!isFinite(endMs)) return;
        const nowMs = now.getTime();
        const CLEAR_GRACE_MS = 2 * 60 * 1000;
        if (nowMs >= endMs + CLEAR_GRACE_MS) {
            clearLatch();
            return;
        }
        const delay = endMs + CLEAR_GRACE_MS - nowMs;
        const t = window.setTimeout(() => clearLatch(), Math.max(0, delay));
        return () => window.clearTimeout(t);
    }, [latched, now, clearLatch]);

    // Immediate clear if override marks done/canceled or window no longer trusted
    React.useEffect(() => {
        if (!latched) return;
        function maybeClear() {
            try {
                if (!latched) return;
                const ov = getAppointmentOverride(latched.id) as
                    | { status?: 'done' | 'canceled' | 'scheduled' }
                    | undefined;
                const nowMs = Date.now();
                const endMs = new Date(latched.endAt).getTime();
                const FINAL_MARGIN_MS = 15 * 1000;
                if (
                    (ov &&
                        (ov.status === 'done' || ov.status === 'canceled')) ||
                    (isFinite(endMs) && nowMs > endMs + FINAL_MARGIN_MS) ||
                    !hasTrustedWindow
                ) {
                    clearLatch();
                }
            } catch {
                /* noop */
            }
        }
        maybeClear();
        const handler = () => maybeClear();
        window.addEventListener('appointments:changed', handler);
        return () =>
            window.removeEventListener('appointments:changed', handler);
    }, [latched, clearLatch, hasTrustedWindow]);

    // External events to force clear (client:clearOngoing)
    React.useEffect(() => {
        function onClear(e: Event) {
            const ce = e as CustomEvent<{ clientId?: number }>;
            if (ce.detail?.clientId === client.id) {
                setOverrideOngoing(null);
                clearLatch();
                setSuppressUntil(Date.now() + 5000);
            }
        }
        window.addEventListener(
            'client:clearOngoing',
            onClear as EventListener,
        );
        return () =>
            window.removeEventListener(
                'client:clearOngoing',
                onClear as EventListener,
            );
    }, [client.id, clearLatch]);

    function suppress(ms: number) {
        setSuppressUntil(Date.now() + ms);
    }

    function afterFinalizeSuccess() {
        setOverrideOngoing(null);
        clearLatch();
        suppress(8000);
    }

    if (debug) {
        // Throttle debug logging per client using WeakMap
        const dbgMap: WeakMap<ClientBasic, { last: number }> =
            (
                useClientOngoingState as unknown as {
                    _dbg?: WeakMap<ClientBasic, { last: number }>;
                }
            )._dbg ?? new WeakMap();
        (
            useClientOngoingState as unknown as {
                _dbg?: WeakMap<ClientBasic, { last: number }>;
            }
        )._dbg = dbgMap;
        const entry = dbgMap.get(client) || { last: 0 };
        const nowMs = now.getTime();
        if (nowMs - entry.last > 5000) {
            entry.last = nowMs;
            dbgMap.set(client, entry);
            try {
                console.log('[ongoing-debug-hook]', {
                    clientId: client.id,
                    isScheduled,
                    startISO,
                    endISO,
                    displayStartISO,
                    displayEndISO,
                    effectiveApptId,
                    windowFromServer,
                    windowFromOverride,
                    hasTrustedWindow,
                    isOngoingRaw,
                    isOngoing,
                });
            } catch {
                /* noop */
            }
        }
    }

    return {
        isOngoing,
        isOngoingRaw,
        displayStartISO,
        displayEndISO,
        effectiveApptId,
        suppress,
        afterFinalizeSuccess,
        hasTrustedWindow,
        latchedId: latched?.id ?? null,
    };
}
