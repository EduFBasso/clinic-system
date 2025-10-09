// Centraliza heurística de abertura do formulário de cliente
// - Mobile: navega na mesma aba
// - Desktop: abre popup (para edição) ou nova popup (novo)
// Fallback: se popup bloqueada, faz navigation na mesma aba.

interface OpenClientFormOptions {
    id?: number; // se omitido => novo cliente
    focus?: boolean; // tentar focar popup ao abrir
}

export function openClientForm(opts: OpenClientFormOptions = {}) {
    const { id, focus = true } = opts;
    const base = id ? `/clients/edit/${id}` : '/clients/new';
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    if (isMobile) {
        window.location.href = base;
        return;
    }
    const features = 'width=900,height=700,toolbar=no,menubar=no,location=no';
    const w = window.open(base, '_blank', features);
    if (!w) {
        // Popup bloqueada → fallback para navegação
        window.location.href = base;
        return;
    }
    try {
        if (focus) w.focus();
    } catch {
        /* noop */
    }
}

export default openClientForm;
