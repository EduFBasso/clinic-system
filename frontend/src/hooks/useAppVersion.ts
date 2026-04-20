// src/hooks/useAppVersion.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE } from '../config/api';

export type ServerVersionInfo = {
    header?: string;
    body?: string;
};

type VersionState = {
    hasUpdate: boolean;
    currentAccepted: string | null; // version tied to current SPA session
    latestSeen: string | null; // most recent version fetched from server
    checkNow: () => void;
    dismiss: () => void; // hide banner for current session only
};

const LS_ACCEPTED_KEY = 'app.version.accepted';
const LS_LAST_SEEN_KEY = 'app.version.lastSeen';

export async function fetchServerVersion(): Promise<ServerVersionInfo | null> {
    try {
        // Prefer /health/full which returns a body with version too
        const res = await fetch(`${API_BASE}/health/full`, {
            method: 'GET',
            credentials: 'omit',
        });
        const header = res.headers.get('X-App-Version') || undefined;
        let bodyVer: string | undefined;
        try {
            // health/full returns { status, database, version, time }
            const json = (await res.json()) as { version?: string };
            if (
                json &&
                typeof json.version === 'string' &&
                json.version.trim()
            ) {
                bodyVer = json.version.trim();
            }
        } catch {
            // ignore JSON parse errors
        }
        return { header, body: bodyVer };
    } catch {
        return null;
    }
}

export function coalesceVersion(v: ServerVersionInfo | null): string | null {
    if (!v) return null;
    const c = v.header && v.header.trim();
    if (c) return c;
    const b = v.body && v.body.trim();
    return b || null;
}

export function useAppVersionWatcher(intervalMs = 5 * 60 * 1000): VersionState {
    const [currentAccepted, setCurrentAccepted] = useState<string | null>(null);
    const [latestSeen, setLatestSeen] = useState<string | null>(null);
    const [hasUpdate, setHasUpdate] = useState(false);
    const dismissedRef = useRef(false);

    const runCheck = useCallback(async () => {
        const v = coalesceVersion(await fetchServerVersion());
        if (!v) return;
        setLatestSeen(v);
        try {
            localStorage.setItem(LS_LAST_SEEN_KEY, v);
        } catch {
            /* ignore */
        }
        // Load accepted if missing in state
        const accepted =
            currentAccepted ??
            (() => {
                try {
                    return localStorage.getItem(LS_ACCEPTED_KEY);
                } catch {
                    return null;
                }
            })();

        if (accepted === null) {
            // First run on this device/session: set accepted = current server version
            try {
                localStorage.setItem(LS_ACCEPTED_KEY, v);
            } catch {
                /* ignore */
            }
            setCurrentAccepted(v);
            setHasUpdate(false);
            return;
        }

        setCurrentAccepted(accepted);
        if (accepted && v && accepted !== v && !dismissedRef.current) {
            setHasUpdate(true);
        }
    }, [currentAccepted]);

    // Initial check
    useEffect(() => {
        runCheck();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Periodic checks
    useEffect(() => {
        if (!intervalMs) return;
        const id = window.setInterval(runCheck, intervalMs);
        return () => window.clearInterval(id);
    }, [intervalMs, runCheck]);

    const dismiss = useCallback(() => {
        dismissedRef.current = true;
        setHasUpdate(false);
    }, []);

    return {
        hasUpdate,
        currentAccepted,
        latestSeen,
        checkNow: runCheck,
        dismiss,
    };
}

export function acceptAndReload() {
    try {
        // Move lastSeen into accepted to avoid banner flicker if reload fails mid-way
        const last = localStorage.getItem(LS_LAST_SEEN_KEY);
        if (last) localStorage.setItem(LS_ACCEPTED_KEY, last);
    } catch {
        /* ignore */
    }
    // Simple reload; cache headers for index.html will determine if a fresh shell is fetched
    window.location.reload();
}
