// Global, ephemeral overrides to smooth out UI after mutations (e.g., finalize)
// Keeps a minimal in-memory map of appointmentId -> { status?: 'done'|'canceled'|'scheduled' }
// and a small event bus to notify listeners. This avoids the brief "ongoing" blink
// right after a finalize until network refetch completes.

type Status = 'scheduled' | 'done' | 'canceled';

export type Override = {
    status?: Status;
    // Permite sobrescrever o horário de término localmente (ex: cancelamento em andamento encurta fim para agora)
    end_at?: string;
    // Momento real em que a sessão terminou (finalize ou cancel) para exibição imediata
    real_closed_at?: string;
    real_closed_reason?: 'done' | 'canceled';
    // Preserva o horário de término ORIGINAL agendado antes de qualquer encurtamento (para comparação e exibição coerente)
    original_end_at?: string;
};

// Internamente adicionamos um timestamp (__ts) para suportar limpeza TTL sem expor
// no tipo público.
type InternalOverride = Override & { __ts: number };

const store = new Map<number, InternalOverride>();

// TTL padrão: 60 minutos (mínimo prático de duração de consulta)
const OVERRIDE_TTL_MS = 60 * 60 * 1000; // 60m
// Frequência de varredura: a cada 5 minutos é suficiente sem custo perceptível
const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5m

let sweepTimer: ReturnType<typeof setInterval> | undefined;

function shouldExpire(o: InternalOverride, now: number) {
    // Expira apenas estados finais (done/canceled) após TTL.
    if (o.status !== 'done' && o.status !== 'canceled') return false;
    return now - o.__ts > OVERRIDE_TTL_MS;
}

function sweep(now = Date.now()) {
    if (!store.size) return;
    const removed: number[] = [];
    for (const [id, o] of store.entries()) {
        if (shouldExpire(o, now)) {
            store.delete(id);
            removed.push(id);
        }
    }
    if (removed.length) {
        notify(removed);
    }
}

function ensureSweepTimer() {
    if (typeof window === 'undefined') return; // em testes node/vitest pode não haver window
    if (!sweepTimer) {
        sweepTimer = setInterval(() => {
            try {
                sweep();
            } catch {
                /* noop */
            }
        }, SWEEP_INTERVAL_MS);
        // Evita manter o processo vivo em ambientes que suportam unref (Node); no browser é ignorado.
        const maybeTimer: unknown = sweepTimer;
        if (
            maybeTimer &&
            typeof maybeTimer === 'object' &&
            'unref' in maybeTimer
        ) {
            const t = maybeTimer as { unref?: () => void };
            if (typeof t.unref === 'function') t.unref();
        }
    }
}

ensureSweepTimer();

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
    const prev = store.get(id);
    const now = Date.now();
    // Preservar original_end_at: se ainda não havia e estamos recebendo um end_at diferente, capturamos.
    let original_end_at: string | undefined = prev?.original_end_at;
    if (!original_end_at) {
        // Se override trouxe explicitamente original_end_at, usamos.
        if (ov.original_end_at) original_end_at = ov.original_end_at;
        else if (ov.end_at && prev?.end_at && ov.end_at !== prev.end_at) {
            // end_at mudou – preservar o anterior como original se fizer sentido
            original_end_at = prev.end_at;
        } else if (ov.end_at && !prev?.end_at) {
            // Primeira vez definindo end_at via override; não sabemos se haverá encurtamento – não marca ainda.
        }
    }
    const merged: InternalOverride = {
        ...(prev || { __ts: now }),
        ...ov,
        ...(original_end_at ? { original_end_at } : null),
        __ts: now,
    };
    store.set(id, merged);
    notify([id]);
}

export function clearAppointmentOverride(id: number) {
    if (store.has(id)) {
        store.delete(id);
        notify([id]);
    }
}

export function getAppointmentOverride(id: number): Override | undefined {
    const o = store.get(id);
    if (!o) return undefined;
    return { ...o }; // retorna cópia sem risco de mutação externa
}

export function subscribeOverrides(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

// Test-only utility (not used in production code) to clear all overrides between tests.
// Exposed with a leading double underscore to discourage accidental app usage.
export function __clearOverridesForTests() {
    if (store.size) {
        store.clear();
        notify();
    }
}

// Força uma varredura imediata (apenas testes / debug)
export function __forceSweepOverridesTTL(now?: number) {
    sweep(now);
}

// Ajusta artificialmente o timestamp para facilitar testes de expiração.
export function __setOverrideTimestampForTests(id: number, ts: number) {
    const cur = store.get(id);
    if (cur) {
        cur.__ts = ts;
    }
}

// Export de constantes para eventual monitoramento externo / testes.
export const __OVERRIDE_TTL_MS = OVERRIDE_TTL_MS;
export const __SWEEP_INTERVAL_MS = SWEEP_INTERVAL_MS;
