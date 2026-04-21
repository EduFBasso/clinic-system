export type FlashMessage = {
    text: string;
    type?: 'success' | 'error' | 'info' | 'warning';
    autoCloseMs?: number;
};

export type FlashMessageScope = 'catalog-products' | 'catalog-services';

function flashMessageKey(scope: FlashMessageScope) {
    return `flashMessage:${scope}`;
}

export function queueFlashMessage(
    scope: FlashMessageScope,
    message: FlashMessage,
) {
    try {
        sessionStorage.setItem(flashMessageKey(scope), JSON.stringify(message));
    } catch {
        /* noop */
    }
}

export function consumeFlashMessage(scope: FlashMessageScope) {
    try {
        const key = flashMessageKey(scope);
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        sessionStorage.removeItem(key);
        const parsed = JSON.parse(raw) as FlashMessage;
        return parsed?.text ? parsed : null;
    } catch {
        return null;
    }
}

export function getCatalogFlashScope(returnTo: string): FlashMessageScope | null {
    if (returnTo === '/catalog/products') return 'catalog-products';
    if (returnTo === '/catalog/services') return 'catalog-services';
    return null;
}