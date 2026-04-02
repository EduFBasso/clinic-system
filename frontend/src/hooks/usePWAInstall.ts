// frontend/src/hooks/usePWAInstall.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function usePWAInstall() {
    const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);
    const [canInstall, setCanInstall] = useState(false);
    const [installOutcome, setInstallOutcome] = useState<
        'accepted' | 'dismissed' | null
    >(null);

    const isStandalone = useMemo(() => {
        try {
            return (
                (window.matchMedia &&
                    window.matchMedia('(display-mode: standalone)').matches) ||
                (navigator as unknown as { standalone?: boolean })
                    .standalone === true
            );
        } catch {
            return false;
        }
    }, []);

    const isIOS = useMemo(() => {
        const ua = navigator.userAgent || navigator.vendor;
        return /iPad|iPhone|iPod/i.test(ua);
    }, []);

    useEffect(() => {
        const handler = (e: Event) => {
            // intercept default mini-infobar
            e.preventDefault?.();
            deferredRef.current = e as BeforeInstallPromptEvent;
            setCanInstall(true);
        };
        window.addEventListener(
            'beforeinstallprompt',
            handler as unknown as EventListener,
        );
        return () =>
            window.removeEventListener(
                'beforeinstallprompt',
                handler as unknown as EventListener,
            );
    }, []);

    const promptInstall = useCallback(async () => {
        const evt = deferredRef.current;
        if (!evt) return 'unavailable' as const;
        try {
            await evt.prompt();
            const choice = await evt.userChoice?.catch(() => null);
            if (choice?.outcome === 'accepted') {
                setInstallOutcome('accepted');
                setCanInstall(false);
                deferredRef.current = null;
                return 'accepted' as const;
            } else {
                setInstallOutcome('dismissed');
                return 'dismissed' as const;
            }
        } catch {
            return 'error' as const;
        }
    }, []);

    return {
        canInstall,
        promptInstall,
        isStandalone,
        isIOS,
        installOutcome,
    } as const;
}

export default usePWAInstall;
