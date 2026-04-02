import { emit } from '../events/bus';

export type FocusClientOptions = {
    // If true (default), emit an event to ensure the page/body scroll is unlocked before focusing
    unlockScroll?: boolean;
    // Optional delay before emitting the focus event. Useful when closing modals first
    delayMs?: number;
};

/**
 * Programmatically focus and scroll to a ClientCard under the "Filtrar Cliente" input.
 * This centralizes the behavior used across multiple surfaces (Home, Daily, QuickSchedule, etc.).
 */
export function focusClientCard(
    clientId: number,
    options: FocusClientOptions = {},
) {
    const { unlockScroll = true, delayMs = 0 } = options;
    try {
        if (unlockScroll) {
            // Some modals lock scroll; ensure it's unlocked before focusing
            window.dispatchEvent(new Event('ensureScrollUnlocked'));
        }
    } catch {
        /* noop */
    }

    const fire = () => {
        try {
            emit('scrollToClientCard', { clientId });
        } catch {
            /* noop */
        }
    };

    if (delayMs > 0) {
        setTimeout(() => requestAnimationFrame(fire), delayMs);
    } else {
        requestAnimationFrame(fire);
    }
}

export default focusClientCard;
