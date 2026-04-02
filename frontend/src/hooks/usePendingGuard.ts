import React from 'react';
import { getNow } from '../utils/now';
import { findFirstPendingForClient } from '../services/pending';

export interface PendingLike {
    id: number;
    start_at: string;
    end_at: string;
    client: number | { id: number };
    title?: string;
    notes?: string;
}

interface UsePendingGuardArgs {
    open: boolean;
    isEdit: boolean;
    clientId: number;
}

export function usePendingGuard({
    open,
    isEdit,
    clientId,
}: UsePendingGuardArgs) {
    const [found, setFound] = React.useState<PendingLike | null>(null);
    const [done, setDone] = React.useState<boolean>(!!isEdit);
    const isMountedRef = React.useRef(true);
    React.useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);
    const refresh = React.useCallback(() => {
        let cancelled = false;
        // Avoid scheduling work in non-DOM contexts or when not open
        if (typeof window === 'undefined' || !open || isEdit) {
            setDone(true);
            setFound(null);
            return () => {};
        }
        (async () => {
            try {
                const res = await findFirstPendingForClient(clientId, getNow());
                if (!cancelled && isMountedRef.current) {
                    if (!res) setFound(null);
                    else
                        setFound({
                            id: res.id,
                            start_at: res.start_at,
                            end_at: res.end_at,
                            client:
                                typeof res.client === 'number'
                                    ? res.client
                                    : (res.client as { id: number }).id,
                            title: res.title,
                            notes: res.notes,
                        });
                }
            } catch {
                if (!cancelled && isMountedRef.current) setFound(null);
            } finally {
                if (!cancelled && isMountedRef.current) setDone(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, isEdit, clientId]);

    React.useEffect(() => {
        const dispose = refresh();
        return () => {
            if (typeof dispose === 'function') dispose();
        };
    }, [refresh]);

    return { found, done, refresh } as const;
}
