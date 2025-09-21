import { useEffect, useMemo } from 'react';

export type OngoingSnapshot = {
    startAt: string;
    endAt: string;
    updatedAt: number; // epoch ms
};

function readSnapshot(clientId: number | string): OngoingSnapshot | null {
    try {
        const raw = localStorage.getItem(`client:ongoing:${clientId}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as OngoingSnapshot;
        if (!parsed || !parsed.startAt || !parsed.endAt || !parsed.updatedAt)
            return null;
        return parsed;
    } catch {
        return null;
    }
}

function writeSnapshot(clientId: number | string, snap: OngoingSnapshot) {
    try {
        localStorage.setItem(
            `client:ongoing:${clientId}`,
            JSON.stringify(snap),
        );
    } catch {
        /* noop */
    }
}

function isInWindow(
    now: Date,
    startISO?: string | null,
    endISO?: string | null,
    graceMs = 60_000,
) {
    if (!startISO || !endISO) return false;
    const start = new Date(startISO).getTime();
    const end = new Date(endISO).getTime();
    const t = now.getTime();
    return isFinite(start) && isFinite(end) && start <= t && t < end + graceMs;
}

export function useOngoingSnapshot(opts: {
    clientId: number | string;
    startAt?: string | null;
    endAt?: string | null;
    serverIsScheduled: boolean;
    now: Date;
    graceMs?: number; // extra time to keep style after end
    maxAgeMs?: number; // max age to trust snapshot when server is off (default ~12h)
}) {
    const { clientId, startAt, endAt, serverIsScheduled, now } = opts;
    const graceMs = opts.graceMs ?? 90_000; // 1.5min de tolerância
    const maxAgeMs = opts.maxAgeMs ?? 12 * 60 * 60 * 1000; // 12 horas

    // Atualiza snapshot quando servidor fornecer dados confiáveis
    useEffect(() => {
        if (serverIsScheduled && startAt && endAt) {
            writeSnapshot(clientId, { startAt, endAt, updatedAt: Date.now() });
        }
    }, [clientId, serverIsScheduled, startAt, endAt]);

    const { effectiveIsOngoing, source, snapshot } = useMemo(() => {
        // 1) Preferir janela do servidor, se disponível
        if (serverIsScheduled && startAt && endAt) {
            const inWindow = isInWindow(now, startAt, endAt, graceMs);
            return {
                effectiveIsOngoing: inWindow,
                source: 'server' as const,
                snapshot: undefined,
            };
        }
        // 2) fallback: snapshot recente
        const snap = readSnapshot(clientId);
        if (snap) {
            const age = Date.now() - snap.updatedAt;
            if (age <= maxAgeMs) {
                const inWindow = isInWindow(
                    now,
                    snap.startAt,
                    snap.endAt,
                    graceMs,
                );
                if (inWindow) {
                    return {
                        effectiveIsOngoing: true,
                        source: 'snapshot' as const,
                        snapshot: snap,
                    };
                }
            }
        }
        // 3) nenhum
        return {
            effectiveIsOngoing: false,
            source: 'none' as const,
            snapshot: snap ?? undefined,
        };
    }, [clientId, serverIsScheduled, startAt, endAt, now, graceMs, maxAgeMs]);

    return { effectiveIsOngoing, source, snapshot };
}
