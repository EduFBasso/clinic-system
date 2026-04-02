import React from 'react';

export interface UseModalCloseHotkeysOptions {
    open: boolean;
    onClose: () => void;
    closeOnEnter?: boolean;
    closeOnEscape?: boolean;
}

/**
 * Adds Enter/Escape listeners to close a modal when open. Use in modals or dialogs
 * to keep behavior consistent across the app.
 */
export function useModalCloseHotkeys({
    open,
    onClose,
    closeOnEnter = true,
    closeOnEscape = true,
}: UseModalCloseHotkeysOptions) {
    // Enter
    React.useEffect(() => {
        if (!open || !closeOnEnter) return;
        function onKeyDown(e: KeyboardEvent) {
            if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !e.ctrlKey &&
                !e.altKey &&
                !e.metaKey
            ) {
                e.preventDefault();
                onClose();
            }
        }
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [open, closeOnEnter, onClose]);

    // Escape
    React.useEffect(() => {
        if (!open || !closeOnEscape) return;
        function onKeyDown(e: KeyboardEvent) {
            if (
                e.key === 'Escape' &&
                !e.shiftKey &&
                !e.ctrlKey &&
                !e.altKey &&
                !e.metaKey
            ) {
                e.preventDefault();
                onClose();
            }
        }
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [open, closeOnEscape, onClose]);
}
