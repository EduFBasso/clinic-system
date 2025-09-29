// frontend/src/hooks/useUnsavedChangesGuard.ts
// Guard against accidental navigation (back/forward/refresh) when there are unsaved changes.
// Works by:
// - beforeunload: shows native browser prompt on tab close/refresh
// - popstate: intercepts back/forward and confirms if user wants to leave
// - pushState: pushes a marker state so we can re-push if user cancels
import { useEffect, useRef } from 'react';

export function useUnsavedChangesGuard(enabled: boolean, message?: string) {
    const enabledRef = useRef(enabled);
    enabledRef.current = enabled;

    useEffect(() => {
        if (!enabled) return;

        const confirmMessage =
            message || 'Há alterações não salvas. Deseja realmente sair?';

        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!enabledRef.current) return;
            e.preventDefault();
            // Chrome requires returnValue to be set
            e.returnValue = confirmMessage;
            return confirmMessage;
        };
        window.addEventListener('beforeunload', onBeforeUnload);

        // Push a marker state so back button triggers popstate we can cancel
        const originalState = window.history.state;
        const marker = { __FORM_GUARD__: Date.now() } as const;
        try {
            window.history.pushState(
                { ...(originalState || {}), ...marker },
                document.title,
            );
        } catch {
            // ignore pushState errors
        }

        const onPopState = () => {
            if (!enabledRef.current) return;
            const ok = window.confirm(confirmMessage);
            if (!ok) {
                // Re-push to keep user on page
                try {
                    window.history.pushState(
                        {
                            ...((window.history.state as Record<
                                string,
                                unknown
                            > | null) || {}),
                            ...marker,
                        },
                        document.title,
                    );
                } catch {
                    // noop
                }
            } else {
                // Allow navigation; remove beforeunload to avoid double prompt on next page
                window.removeEventListener('beforeunload', onBeforeUnload);
            }
        };
        window.addEventListener('popstate', onPopState);

        return () => {
            window.removeEventListener('beforeunload', onBeforeUnload);
            window.removeEventListener('popstate', onPopState);
            // Try to clean up marker by replacing state without the marker
            try {
                const state = window.history.state as Record<
                    string,
                    unknown
                > | null;
                if (
                    state &&
                    Object.prototype.hasOwnProperty.call(
                        state,
                        '__FORM_GUARD__',
                    )
                ) {
                    const rest = { ...state } as Record<string, unknown>;
                    delete (rest as Record<string, unknown>)['__FORM_GUARD__'];
                    window.history.replaceState(rest, document.title);
                }
            } catch {
                // ignore
            }
        };
    }, [enabled, message]);
}

export default useUnsavedChangesGuard;
