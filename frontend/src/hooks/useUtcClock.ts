import { useEffect, useState } from 'react';
import { getActiveDrift, measureDrift } from '../utils/timeDrift';

// Retorna { nowLocal, nowCorrectedUTC: Date, hhmmUTC, driftMsApplied }
// Atualiza a cada intervalMs (default 30s) alinhando ao próximo minuto.
// Aplica correção de drift se medição recente (<5min) disponível.
export function useUtcClock(
    intervalMs = 30000,
    driftRefreshMs = 3 * 60 * 1000,
) {
    // Detecta ambiente de teste (Vitest) para modo rápido sem timers/drift fetch
    // Acesso defensivo para não quebrar build TS quando vitest não está presente
    let isTestEnv = false;
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const meta: any = import.meta;
        isTestEnv = !!(meta && meta.vitest);
    } catch {
        isTestEnv = false;
    }
    const [now, setNow] = useState<Date>(() => new Date());
    const [drift, setDrift] = useState<number>(() => getActiveDrift());

    // Mesmo em teste preservamos a ordem dos hooks; simplesmente não instalamos timers

    // Loop de tick alinhado
    useEffect(() => {
        if (isTestEnv) return; // não instalar timers em testes
        function alignDelay() {
            const d = new Date();
            const msIntoMinute = d.getSeconds() * 1000 + d.getMilliseconds();
            const remain = 60_000 - msIntoMinute + 200; // 200ms após virar o minuto
            return Math.max(500, Math.min(remain, 60_000));
        }
        let t1: number | null = null;
        let t2: number | null = null;
        t1 = window.setTimeout(() => {
            setNow(new Date());
            t2 = window.setInterval(
                () => setNow(new Date()),
                intervalMs,
            ) as unknown as number;
        }, alignDelay()) as unknown as number;
        return () => {
            if (t1 != null) window.clearTimeout(t1 as unknown as number);
            if (t2 != null) window.clearInterval(t2 as unknown as number);
        };
    }, [intervalMs, isTestEnv]);

    // Medição inicial de drift
    useEffect(() => {
        if (isTestEnv) return; // não medir drift em testes
        let cancelled = false;
        (async () => {
            const d = await measureDrift(false);
            if (!cancelled) setDrift(d);
        })();
        return () => {
            cancelled = true;
        };
    }, [isTestEnv]);

    // Re-medição periódica
    useEffect(() => {
        if (isTestEnv) return; // skip periodic drift
        if (!driftRefreshMs) return;
        const id = window.setInterval(async () => {
            const d = await measureDrift(false);
            setDrift(d);
        }, driftRefreshMs);
        return () => window.clearInterval(id);
    }, [driftRefreshMs, isTestEnv]);

    const corrected = new Date(now.getTime() + (isTestEnv ? 0 : drift));
    const hh = String(corrected.getUTCHours()).padStart(2, '0');
    const mm = String(corrected.getUTCMinutes()).padStart(2, '0');
    const hhmmUTC = `${hh}:${mm}`;
    return {
        nowLocal: now,
        nowCorrectedUTC: corrected,
        hhmmUTC,
        driftMsApplied: isTestEnv ? 0 : drift,
    };
}
