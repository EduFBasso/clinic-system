import { useOngoingSweep } from '../hooks/useOngoingSweep';
import {
    getOngoingSnapshot,
    clearOngoingSnapshot,
} from '../hooks/useOngoingSnapshot';
import {
    readOngoingLatch,
    writeOngoingLatch,
    clearOngoingLatch,
} from '../hooks/useOngoingLatch';
import type { Appointment } from '../hooks/useAppointments';

// Lightweight global API to interact with "em andamento" state across the app

export type OngoingInfo = {
    // appointment if a sweep found an active one for the client
    sweep?: Appointment;
    // snapshot window if present and considered valid by readers
    snapshot?: { startAt: string; endAt: string; updatedAt: number } | null;
    // client-scoped latch persisted locally
    latch?: {
        id: number;
        startAt: string;
        endAt: string;
        latchedAt: number;
    } | null;
};

// Hook facade for reading the current sweep map (no extra network). Consumers can combine with non-hook getters.
export function useOngoingMap(windowMs = 60_000) {
    return useOngoingSweep(undefined, windowMs);
}

export function getOngoingForClient(clientId: number, opts?: { now?: Date }) {
    const snapshot = getOngoingSnapshot(clientId);
    const latch = readOngoingLatch(clientId);
    // sweep is hook-backed; direct read must be passed in by the caller when using the hook.
    // This function focuses on non-hook storage; prefer useOngoingMap() for sweep results.
    const info: OngoingInfo = { snapshot, latch };
    // Derive a boolean suggestion of ongoing based on snapshot window
    const now = opts?.now ?? new Date();
    const snapInWindow = snapshot
        ? new Date(snapshot.startAt) <= now && now < new Date(snapshot.endAt)
        : false;
    return { info, snapInWindow } as const;
}

export function setLatchedOngoing(
    clientId: number,
    l: {
        id: number;
        startAt: string;
        endAt: string;
    },
) {
    writeOngoingLatch(clientId, { ...l, latchedAt: Date.now() });
}

export function clearOngoing(clientId: number) {
    clearOngoingLatch(clientId);
    clearOngoingSnapshot(clientId);
    try {
        window.dispatchEvent(
            new CustomEvent('client:clearOngoing', { detail: { clientId } }),
        );
    } catch {
        /* noop */
    }
}

// Soft signal to have the singleton sweeper run once soon (without creating a new loop)
export function sweepNow() {
    try {
        window.dispatchEvent(new Event('appointments:changed'));
    } catch {
        /* noop */
    }
}
