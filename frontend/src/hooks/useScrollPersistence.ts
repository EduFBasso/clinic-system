import { useEffect, useRef } from 'react';

const SCROLL_SESSION_KEY = 'home.scrollY';

/**
 * Persiste a posição de scroll no sessionStorage (sobrevive à navegação para edição/criação
 * e ao retorno para a lista) e restaura uma única vez após o carregamento inicial dos clientes.
 */
export function useScrollPersistence(loading: boolean, clientsLength: number): void {
    const hasRestoredRef = useRef(false);

    // Salva posição continuamente (debounce 200ms) e imediatamente ao sair da página.
    useEffect(() => {
        let saveTimer: number | null = null;
        const save = () => {
            try {
                sessionStorage.setItem(SCROLL_SESSION_KEY, String(Math.round(window.scrollY)));
            } catch { /* noop */ }
        };
        const onScroll = () => {
            if (saveTimer) window.clearTimeout(saveTimer);
            saveTimer = window.setTimeout(save, 200);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('pagehide', save);
        return () => {
            if (saveTimer) window.clearTimeout(saveTimer);
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('pagehide', save);
        };
    }, []);

    // Restaura posição uma única vez após os clientes carregarem.
    useEffect(() => {
        if (loading || clientsLength === 0) return;
        if (hasRestoredRef.current) return;
        hasRestoredRef.current = true;
        try {
            const saved = sessionStorage.getItem(SCROLL_SESSION_KEY);
            if (saved) {
                const y = Number(saved);
                if (Number.isFinite(y) && y > 0) {
                    requestAnimationFrame(() => {
                        window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
                    });
                }
            }
        } catch { /* noop */ }
    }, [loading, clientsLength]);
}
