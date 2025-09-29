import React from 'react';

type Latch = {
    id: number; // appointment id
    startAt: string;
    endAt: string;
    latchedAt: number; // epoch ms
};

const key = (clientId: number | string) => `client:ongoing:latch:${clientId}`;

export function readOngoingLatch(clientId: number | string): Latch | null {
    try {
        const raw = localStorage.getItem(key(clientId));
        if (!raw) return null;
        const v = JSON.parse(raw) as Latch;
        if (!v || typeof v.id !== 'number' || !v.startAt || !v.endAt)
            return null;
        return v;
    } catch {
        return null;
    }
}

export function writeOngoingLatch(clientId: number | string, l: Latch) {
    try {
        localStorage.setItem(key(clientId), JSON.stringify(l));
    } catch {
        /* noop */
    }
}

export function clearOngoingLatch(clientId: number | string) {
    try {
        localStorage.removeItem(key(clientId));
    } catch {
        /* noop */
    }
}

export function useOngoingLatch(clientId: number | string) {
    const [latched, setLatchedState] = React.useState<Latch | null>(() =>
        readOngoingLatch(clientId),
    );

    const setLatched = React.useCallback(
        (l: { id: number; startAt: string; endAt: string }) => {
            const val: Latch = { ...l, latchedAt: Date.now() };
            setLatchedState(val);
            writeOngoingLatch(clientId, val);
        },
        [clientId],
    );

    const clear = React.useCallback(() => {
        setLatchedState(null);
        clearOngoingLatch(clientId);
    }, [clientId]);

    // Keep in sync if other tabs update it
    React.useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (!e.key) return;
            if (e.key === key(clientId)) {
                setLatchedState(readOngoingLatch(clientId));
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [clientId]);

    return { latched, setLatched, clear } as const;
}
