import { useEffect, useRef, useState, useCallback } from 'react';
// (no direct imports needed here besides apiFetch)
import { apiFetch, ApiError } from '../utils/apiFetch';

// Lightweight session summary + list fetching with simple in-memory caching.
// Phase 1+2: no polling; fetch on demand when About/Sobre modal opens or when explicitly refreshed.
// Extend later with heartbeat if backend supports.

export interface SessionItem {
    id: string;
    device_id: string;
    created_at: string;
    last_seen: string;
    is_current?: boolean;
    ua?: string;
    device_type?: string;
    os?: string;
    browser?: string;
}

export interface SessionsSummary {
    count: number;
    has_others: boolean;
}

interface UseSessionsListOpts {
    open: boolean; // whether modal is open
    staleMs?: number; // cache ttl
}

const DEFAULT_STALE_MS = 30_000;

export function useSessionsSummary(trigger: number | boolean) {
    const [summary, setSummary] = useState<SessionsSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const token = localStorage.getItem('accessToken');
            if (!token) {
                // Sem token não tenta buscar; garante estado neutro
                setSummary(null);
                return;
            }
            setLoading(true);
            setError(null);
            try {
                const json = (await apiFetch('/sessions/summary')) as unknown;
                if (!cancelled) setSummary(json as unknown as SessionsSummary);
            } catch (e) {
                if (!cancelled) {
                    if (e instanceof ApiError) setError(e.message);
                    else setError(e instanceof Error ? e.message : 'Erro');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [trigger]);

    return { summary, loading, error };
}

export function useSessionsList({
    open,
    staleMs = DEFAULT_STALE_MS,
}: UseSessionsListOpts) {
    const [sessions, setSessions] = useState<SessionItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const lastFetchRef = useRef<number>(0);

    const fetchList = useCallback(
        async (force = false) => {
            if (!open) return;
            const token = localStorage.getItem('accessToken');
            if (!token) return; // evita chamada sem token
            const now = Date.now();
            if (
                !force &&
                sessions.length &&
                now - lastFetchRef.current < staleMs
            )
                return;
            setLoading(true);
            setError(null);
            try {
                const json = (await apiFetch('/sessions/active')) as unknown;
                setSessions(json as unknown as SessionItem[]);
                lastFetchRef.current = now;
            } catch (e) {
                if (e instanceof ApiError) setError(e.message);
                else setError(e instanceof Error ? e.message : 'Erro');
            } finally {
                setLoading(false);
            }
        },
        [open, sessions.length, staleMs],
    );

    useEffect(() => {
        // Always force a fresh fetch when the panel opens to avoid showing a cached list
        if (open) {
            fetchList(true);
        } else {
            // When closed, we keep current data; next open will force refresh
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        // Also fetch (non-forced) if dependencies change meaningfully (staleness window)
        fetchList();
    }, [fetchList]);

    return {
        sessions,
        loading,
        error,
        refresh: () => fetchList(true),
    };
}

export function useRevokeOtherSessions() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{ revoked: number } | null>(null);

    async function revoke() {
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const json = (await apiFetch('/sessions/revoke', {
                method: 'POST',
                body: { mode: 'all_except_current' },
            })) as unknown;
            setResult(json as unknown as { revoked: number });
            return json as unknown as { revoked: number };
        } catch (e) {
            if (e instanceof ApiError) setError(e.message);
            else setError(e instanceof Error ? e.message : 'Erro');
            return null;
        } finally {
            setLoading(false);
        }
    }

    async function revokeSession(sessionId: string) {
        if (!sessionId) return null;
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const json = (await apiFetch('/sessions/revoke', {
                method: 'POST',
                body: { session_id: sessionId },
            })) as unknown;
            setResult(json as unknown as { revoked: number });
            return json as unknown as { revoked: number };
        } catch (e) {
            if (e instanceof ApiError) setError(e.message);
            else setError(e instanceof Error ? e.message : 'Erro');
            return null;
        } finally {
            setLoading(false);
        }
    }

    return { revoke, revokeSession, loading, error, result };
}
