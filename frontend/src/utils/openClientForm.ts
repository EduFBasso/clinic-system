// Centraliza heurística de abertura do formulário de cliente
// - Mobile: navega na mesma aba (via React Router navigate se fornecido, senão window.location)
// - Desktop: abre popup (para edição) ou nova popup (novo)
// Fallback: se popup bloqueada, faz navigation na mesma aba.

import type { NavigateFunction } from 'react-router-dom';

interface OpenClientFormOptions {
    id?: number; // se omitido => novo cliente
    focus?: boolean; // tentar focar popup ao abrir
    navigate?: NavigateFunction; // React Router navigate — se fornecido usa SPA navigation no mobile
}

export function openClientForm(opts: OpenClientFormOptions = {}) {
    const { id, focus = true, navigate } = opts;
    const base = id ? `/clients/edit/${id}` : '/clients/new';
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    if (isMobile) {
        if (navigate) {
            navigate(base);
        } else {
            window.location.href = base;
        }
        return;
    }
    const features = 'width=900,height=700,toolbar=no,menubar=no,location=no';
    const w = window.open(base, '_blank', features);
    if (!w) {
        // Popup bloqueada → fallback para navegação
        if (navigate) {
            navigate(base);
        } else {
            window.location.href = base;
        }
        return;
    }
    try {
        if (focus) w.focus();
    } catch {
        /* noop */
    }
}

export default openClientForm;
