import React from 'react';

export function useClientCardFocusScroll({
    clientId,
    cardRef,
    onSelect,
    futureAppointmentsCount,
    isOngoing,
    isScheduled,
}: {
    clientId: number;
    cardRef: React.RefObject<HTMLDivElement | null>;
    onSelect?: () => void;
    futureAppointmentsCount: number;
    isOngoing: boolean;
    isScheduled: boolean;
}) {
    React.useEffect(() => {
        let cancelled = false;
        const cleanupTimers: number[] = [];

        function cancelByUser() {
            cancelled = true;
        }

        function ensureVisible(attempt: number) {
            if (cancelled) return;
            const el = cardRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const vh = window.innerHeight || document.documentElement.clientHeight;
            const overlapTop = Math.max(
                0,
                Math.min(rect.bottom, vh) - Math.max(rect.top, 0),
            );
            const ratio = overlapTop / rect.height;
            const needsScroll =
                ratio < 0.7 || rect.top < 8 || rect.bottom > vh - 8;

            if (needsScroll) {
                try {
                    const currentY = window.scrollY || window.pageYOffset;
                    const offset = 110;
                    const targetTop = Math.max(0, rect.top + currentY - offset);
                    window.scrollTo({ top: targetTop, behavior: 'smooth' });
                } catch {
                    try {
                        el.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                        });
                    } catch {
                        /* noop */
                    }
                }
            }

            if (attempt < 4) {
                const t = window.setTimeout(
                    () => ensureVisible(attempt + 1),
                    [0, 150, 350, 700, 1200][attempt],
                );
                cleanupTimers.push(t as unknown as number);
            }
        }

        function onScrollEvent(e: Event) {
            const detail = (e as CustomEvent).detail;
            if (detail && detail.clientId === clientId) {
                try {
                    onSelect?.();
                } catch {
                    /* noop */
                }
                requestAnimationFrame(() => ensureVisible(0));
            }
        }

        window.addEventListener('touchstart', cancelByUser, { passive: true });
        window.addEventListener('wheel', cancelByUser, { passive: true });
        window.addEventListener(
            'scrollToClientCard',
            onScrollEvent as EventListener,
        );

        return () => {
            window.removeEventListener(
                'scrollToClientCard',
                onScrollEvent as EventListener,
            );
            window.removeEventListener('touchstart', cancelByUser);
            window.removeEventListener('wheel', cancelByUser);
            cleanupTimers.forEach(timerId => window.clearTimeout(timerId));
        };
    }, [
        cardRef,
        clientId,
        futureAppointmentsCount,
        isOngoing,
        isScheduled,
        onSelect,
    ]);
}