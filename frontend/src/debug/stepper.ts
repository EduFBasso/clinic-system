// Lightweight step-by-step debugger for runtime inspection
// Enable with: localStorage.setItem('debug.step','1'); window.dispatchEvent(new Event('debug:toggle'))

export function isStepEnabled(): boolean {
    try {
        return localStorage.getItem('debug.step') === '1';
    } catch {
        return false;
    }
}

export function setStepEnabled(v: boolean) {
    try {
        if (v) localStorage.setItem('debug.step', '1');
        else localStorage.removeItem('debug.step');
        window.dispatchEvent(new Event('debug:toggle'));
    } catch {
        /* noop */
    }
}

export async function step(label: string, data?: unknown): Promise<void> {
    if (!isStepEnabled()) return;
    try {
        window.dispatchEvent(
            new CustomEvent('debug:step', {
                detail: { label, data, ts: Date.now() },
            }),
        );
    } catch {
        /* noop */
    }
    await new Promise<void>(resolve => {
        const onContinue = () => {
            window.removeEventListener(
                'debug:continue',
                onContinue as EventListener,
            );
            resolve();
        };
        window.addEventListener('debug:continue', onContinue as EventListener, {
            once: true,
        });
    });
}

export function debugLog(label: string, data?: unknown) {
    try {
        window.dispatchEvent(
            new CustomEvent('debug:log', {
                detail: { label, data, ts: Date.now() },
            }),
        );
    } catch {
        /* noop */
    }
}
