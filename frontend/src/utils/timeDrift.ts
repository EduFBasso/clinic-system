// Utilidade para medir e fornecer drift (desvio) entre relógio local e hora do servidor.
// O drift é calculado como: serverUTC - clientNow (em ms).
// Fornece funções para medir (com caching) e recuperar drift ativo enquanto não expira.

import { getServerNowOnce } from '../services/time';

interface DriftState {
    driftMs: number; // server - client
    measuredAt: number; // Date.now() no momento da medição
}

let _state: DriftState | null = null;

const DRIFT_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutos
const DRIFT_MIN_REMEASURE_INTERVAL_MS = 30 * 1000; // evita spam em force false

/** Retorna snapshot bruto (para debug/testes). */
export function getDriftSnapshot(): DriftState | null {
    return _state ? { ...(_state as DriftState) } : null;
}

/** Retorna drift aplicável (0 se expirado ou indisponível). */
export function getActiveDrift(): number {
    if (!_state) return 0;
    const age = Date.now() - _state.measuredAt;
    if (age > DRIFT_MAX_AGE_MS) return 0;
    return _state.driftMs;
}

/** Mede drift se expirado ou se force=true. Retorna drift ativo após operação. */
export async function measureDrift(force = false): Promise<number> {
    const nowTs = Date.now();
    if (!force && _state) {
        const age = nowTs - _state.measuredAt;
        if (age < DRIFT_MIN_REMEASURE_INTERVAL_MS) {
            return getActiveDrift();
        }
    }
    try {
        const before = Date.now();
        const serverDate = await getServerNowOnce();
        const after = Date.now();
        if (serverDate) {
            // RTT simplificado: assumimos latência simétrica e usamos midpoint
            const midpoint = before + (after - before) / 2;
            const driftMs = serverDate.getTime() - midpoint;
            _state = { driftMs, measuredAt: nowTs };
        }
    } catch {
        // Ignora erros - mantém último drift válido
    }
    return getActiveDrift();
}

/** Força reset do estado (principalmente para testes). */
export function resetDriftState() {
    _state = null;
}
