import React from 'react';

/**
 * Hook simples para disparar um evento global indicando mudança de layout relevante
 * (ex.: alteração de altura de header sticky) para que o AppModal possa recomputar
 * bottom compensation e evitar bleed no iOS.
 */
export function useLayoutChangeEvent(triggerDeps: React.DependencyList) {
    React.useEffect(() => {
        // Debounce em rAF para consolidar múltiplas mutações no mesmo frame
        const id = requestAnimationFrame(() => {
            try {
                window.dispatchEvent(new Event('modal:layout-changed'));
            } catch {
                /* noop */
            }
        });
        return () => cancelAnimationFrame(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, triggerDeps);
}

/**
 * Hook que observa o tamanho de um elemento (ResizeObserver) e dispara evento quando muda.
 */
export function useResizeLayoutChange(
    ref: React.RefObject<HTMLElement | null>,
) {
    React.useEffect(() => {
        const el = ref.current;
        if (!el) return;
        // Always install a lightweight window resize fallback (covers JSDOM + browsers with RO but no events fired for offset mutations)
        let lastFallbackH = el.offsetHeight;
        const onResizeFallback = () => {
            const h = el.offsetHeight;
            if (Math.abs(h - lastFallbackH) > 0.5) {
                lastFallbackH = h;
                try {
                    window.dispatchEvent(new Event('modal:layout-changed'));
                } catch {
                    /* noop */
                }
            }
        };
        window.addEventListener('resize', onResizeFallback);
        let lastW = el.offsetWidth;
        let lastH = el.offsetHeight;
        let ro: ResizeObserver | undefined;
        if (typeof ResizeObserver !== 'undefined') {
            try {
                ro = new ResizeObserver(entries => {
                    for (const entry of entries) {
                        const { width, height } = entry.contentRect;
                        if (
                            Math.abs(width - lastW) > 0.5 ||
                            Math.abs(height - lastH) > 0.5
                        ) {
                            lastW = width;
                            lastH = height;
                            try {
                                window.dispatchEvent(
                                    new Event('modal:layout-changed'),
                                );
                            } catch {
                                /* noop */
                            }
                        }
                    }
                });
                ro.observe(el);
            } catch {
                // If construction fails, rely solely on resize fallback
            }
        }
        return () => {
            window.removeEventListener('resize', onResizeFallback);
            if (ro) {
                try {
                    ro.disconnect();
                } catch {
                    /* noop */
                }
            }
        };
    }, [ref]);
}
