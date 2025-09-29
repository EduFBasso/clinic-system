// Debounced event dispatchers to avoid event storms.
// Coalesces multiple calls into a single dispatch within a short window.

const isDev =
    typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';

type Dispatcher = {
    appointmentsChanged: () => void;
    updateClients: () => void;
    flush: () => void;
};

function createDebouncedDispatcher(
    windowRef: Window & typeof globalThis,
    delay = 300,
): Dispatcher {
    let apptTimer: number | null = null;
    let clientsTimer: number | null = null;

    function schedule(timerRef: 'appt' | 'clients') {
        const now = Date.now();
        if (timerRef === 'appt') {
            if (apptTimer != null) return; // already scheduled
            apptTimer = windowRef.setTimeout(() => {
                apptTimer = null;
                if (isDev)
                    console.debug('[dispatchers] fire appointments:changed');
                try {
                    windowRef.dispatchEvent(new Event('appointments:changed'));
                } catch {
                    /* noop */
                }
            }, delay) as unknown as number;
            if (isDev)
                console.debug(
                    '[dispatchers] schedule appointments:changed',
                    now,
                );
        } else {
            if (clientsTimer != null) return;
            clientsTimer = windowRef.setTimeout(() => {
                clientsTimer = null;
                if (isDev) console.debug('[dispatchers] fire updateClients');
                try {
                    windowRef.dispatchEvent(new Event('updateClients'));
                } catch {
                    /* noop */
                }
            }, delay) as unknown as number;
            if (isDev)
                console.debug('[dispatchers] schedule updateClients', now);
        }
    }

    return {
        appointmentsChanged() {
            schedule('appt');
        },
        updateClients() {
            schedule('clients');
        },
        flush() {
            // Fire immediately if scheduled
            if (apptTimer != null) {
                windowRef.clearTimeout(apptTimer as unknown as number);
                apptTimer = null;
                try {
                    windowRef.dispatchEvent(new Event('appointments:changed'));
                } catch {
                    /* noop */
                }
            }
            if (clientsTimer != null) {
                windowRef.clearTimeout(clientsTimer as unknown as number);
                clientsTimer = null;
                try {
                    windowRef.dispatchEvent(new Event('updateClients'));
                } catch {
                    /* noop */
                }
            }
        },
    };
}

export const dispatchers = createDebouncedDispatcher(window, 300);
