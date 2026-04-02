// Centralized business rule constants
// TODO: In future, fetch from backend /config endpoint or feature flags
// Valor default caso não configurado dinamicamente.
export const MAX_FUTURE_APPOINTMENTS = 7;
// Alias mais semântico para regra de negócio (inclui compromisso principal + futuros):
export const MAX_SCHEDULED_APPOINTMENTS_PER_CLIENT = MAX_FUTURE_APPOINTMENTS;

let runtimeMax = MAX_FUTURE_APPOINTMENTS;

export function configureMaxScheduledPerClient(n: number) {
    if (Number.isFinite(n) && n > 0 && n < 500) {
        runtimeMax = Math.floor(n);
        try {
            window.dispatchEvent(
                new CustomEvent('config:changed', {
                    detail: { key: 'maxScheduledPerClient', value: runtimeMax },
                }),
            );
        } catch {
            /* noop */
        }
    } else {
        // inválido, ignora silenciosamente (poderíamos logar)
    }
}

export function getMaxScheduledPerClient(): number {
    return runtimeMax;
}
// If client already has (MAX_FUTURE_APPOINTMENTS - 1) or more, suggest pushing
// the next automatic date at least this many days ahead.
export const SUGGEST_MIN_DAYS_AHEAD_WHEN_NEAR_LIMIT = 7;

// Auto-close do QuickSchedule após criação bem-sucedida (UX). Em futuro, pode virar preferencia persistida.
export const AUTO_CLOSE_QUICK_SCHEDULE_ON_CREATE = true;
