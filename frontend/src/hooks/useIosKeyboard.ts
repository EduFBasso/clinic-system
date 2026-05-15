import { useEffect } from 'react';

/**
 * Detecta abertura/fechamento do teclado virtual no iOS/Android via VisualViewport.
 * Adiciona/remove a classe `keyboardOpen` no `document.body` e expõe as variáveis
 * CSS `--kb-h` (altura do teclado) e `--filter-h` (altura do container de filtro).
 *
 * Só executa em dispositivos móveis (UA check). No desktop é um no-op.
 */
export function useIosKeyboard(filterContainerClass: string): void {
    // Hard reset na montagem: garante que não iniciamos com o body travado
    useEffect(() => {
        document.body.classList.remove('keyboardOpen');
        try {
            (document.documentElement as HTMLElement).style.removeProperty('--kb-h');
            (document.documentElement as HTMLElement).style.removeProperty('--filter-h');
        } catch { /* noop */ }
    }, []);

    useEffect(() => {
        const isMobileUA = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (!isMobileUA) return;

        const input = document.getElementById('client-filter');
        const filterEl = document.querySelector(`.${filterContainerClass}`) as HTMLElement | null;

        const add = () => document.body.classList.add('keyboardOpen');
        const remove = () => document.body.classList.remove('keyboardOpen');
        input?.addEventListener('focus', add);
        input?.addEventListener('blur', remove);

        const vv = window.visualViewport;
        let baseline = vv?.height || window.innerHeight;

        const onResize = () => {
            if (!vv) return;
            const activeEl = document.activeElement as HTMLElement | null;
            const isInputFocused =
                !!activeEl &&
                (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

            // Recalibra baseline quando nenhum input está focado (evita falso positivo por UI do Safari)
            if (!isInputFocused) baseline = vv.height;

            const delta = Math.max(0, baseline - vv.height);
            const keyboardLikelyOpen = isInputFocused && delta > 150;
            document.body.classList.toggle('keyboardOpen', keyboardLikelyOpen);

            (document.documentElement as HTMLElement).style.setProperty(
                '--kb-h',
                keyboardLikelyOpen ? `${Math.round(delta)}px` : '0px',
            );

            const fh = filterEl?.getBoundingClientRect().height || 120;
            (document.documentElement as HTMLElement).style.setProperty(
                '--filter-h',
                `${Math.round(fh)}px`,
            );

            if (keyboardLikelyOpen && document.activeElement === input) {
                setTimeout(() => {
                    input?.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
                }, 0);
            }
        };

        vv?.addEventListener('resize', onResize);

        return () => {
            input?.removeEventListener('focus', add);
            input?.removeEventListener('blur', remove);
            vv?.removeEventListener('resize', onResize);
            document.body.classList.remove('keyboardOpen');
            (document.documentElement as HTMLElement).style.removeProperty('--kb-h');
            (document.documentElement as HTMLElement).style.removeProperty('--filter-h');
        };
    }, [filterContainerClass]);
}
