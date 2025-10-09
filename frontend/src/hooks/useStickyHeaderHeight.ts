import React from 'react';

/**
 * Hook para medir altura de um header sticky (ou qualquer container) e reagir a mudanças.
 * Internamente usa ResizeObserver + rAF para evitar thrash. Retorna:
 *  - ref: atribuir ao elemento
 *  - height: altura atual em px
 */
export function useStickyHeaderHeight() {
    const ref = React.useRef<HTMLElement | null>(null);
    const [height, setHeight] = React.useState(0);

    React.useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        let frame: number | null = null;
        function measure() {
            if (frame) cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                if (!ref.current) return;
                const h = ref.current.offsetHeight;
                setHeight(h);
            });
        }
        measure();
        let ro: ResizeObserver | null = null;
        if (typeof ResizeObserver !== 'undefined') {
            try {
                ro = new ResizeObserver(measure);
                ro.observe(el);
            } catch {
                // On unexpected constructor error, fallback
                window.addEventListener('resize', measure);
            }
        } else {
            window.addEventListener('resize', measure);
        }
        return () => {
            if (frame) cancelAnimationFrame(frame);
            if (ro) {
                try {
                    ro.disconnect();
                } catch {
                    /* noop */
                }
            } else {
                window.removeEventListener('resize', measure);
            }
        };
    }, []);

    return { ref, height } as const;
}
