// Global, ephemeral overrides to smooth out UI after mutations (e.g., finalize)
// Keeps a minimal in-memory map of appointmentId -> { status?: 'done'|'canceled'|'scheduled' }
// and a small event bus to notify listeners. This avoids the brief "ongoing" blink
// right after a finalize until network refetch completes.

type Status = 'scheduled' | 'done' | 'canceled';

type Override = {
    status?: Status;
};

const store = new Map<number, Override>();

type Listener = (ids?: number[]) => void;
const listeners = new Set<Listener>();

function notify(ids?: number[]) {
    for (const l of Array.from(listeners)) {
        try {
            l(ids);
        } catch {
            /* noop */
        }
    }
}

export function setAppointmentOverride(id: number, ov: Override) {
    const prev = store.get(id) || {};
    store.set(id, { ...prev, ...ov });
    notify([id]);
}

export function clearAppointmentOverride(id: number) {
    if (store.has(id)) {
        store.delete(id);
        notify([id]);
    }
}

export function getAppointmentOverride(id: number): Override | undefined {
    return store.get(id);
}

export function subscribeOverrides(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
