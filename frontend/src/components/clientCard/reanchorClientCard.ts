import { focusClientCard } from '../../utils/focusClientCard';

export function reanchorClientCard(clientId: number) {
    try {
        document.body.dataset.keepScroll = '1';
        setTimeout(() => {
            try {
                delete document.body.dataset.keepScroll;
            } catch {
                /* noop */
            }
        }, 800);
    } catch {
        /* noop */
    }

    try {
        window.dispatchEvent(new Event('ensureScrollUnlocked'));
    } catch {
        /* noop */
    }

    setTimeout(() => focusClientCard(clientId), 60);
}