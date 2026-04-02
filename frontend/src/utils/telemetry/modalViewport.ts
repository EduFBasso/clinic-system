// Util de telemetria para AppModal fullscreen viewport compensations.
// Estratégia: emitir CustomEvents locais (ou no futuro enviar para endpoint) com sampling opcional.

export interface ModalViewportMetric {
    modalId?: string;
    bottomComp: number; // pixels adicionais de compensação aplicados
    vhUnit: number; // valor de 1vh efetivo em px (aprox. via clientHeight/100)
    innerHeight: number;
    visualViewportHeight?: number;
    timestamp: number;
    phase: 'open' | 'update' | 'close';
    userAgent?: string;
}

const DEFAULT_SAMPLE_RATE = 1.0; // permitir reduzir se volume alto
let sampleRate = DEFAULT_SAMPLE_RATE;

export function configureModalViewportTelemetry(opts: { sampleRate?: number }) {
    if (typeof opts.sampleRate === 'number') {
        sampleRate = Math.max(0, Math.min(1, opts.sampleRate));
    }
}

function shouldSample() {
    return Math.random() < sampleRate;
}

// Throttle: não emitir 'update' em alta frequência.
const lastEmit: Record<string, number> = {};
const UPDATE_MIN_INTERVAL_MS = 1500;

export function emitModalViewportMetric(metric: ModalViewportMetric) {
    if (!shouldSample()) return;
    const key = metric.modalId || 'default';
    if (metric.phase === 'update') {
        const now = Date.now();
        if (lastEmit[key] && now - lastEmit[key] < UPDATE_MIN_INTERVAL_MS)
            return;
        lastEmit[key] = now;
    }
    try {
        const detail = { ...metric };
        window.dispatchEvent(
            new CustomEvent('modal:viewport-metrics', { detail }),
        );
    } catch {
        /* noop */
    }
}
