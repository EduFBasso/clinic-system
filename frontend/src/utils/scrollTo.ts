// Util central para rolar até um cartão de cliente ou elemento específico
// Padroniza comportamento (centraliza, animação suave) e futura compensação de header
export function scrollElementIntoView(el: HTMLElement) {
    if (!el) return;
    try {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {
        // fallback simples
        el.scrollIntoView();
    }
}

// Dispara um evento global para solicitar que MainContent role até um clientId
export function requestScrollToClient(clientId: number) {
    try {
        window.dispatchEvent(
            new CustomEvent('scrollToClientCard', { detail: { clientId } }),
        );
    } catch {
        /* noop */
    }
}
