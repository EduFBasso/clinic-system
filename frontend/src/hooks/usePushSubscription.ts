import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../config/api';

const VAPID_PUBLIC_KEY =
    (import.meta.env.VITE_VAPID_PUBLIC_KEY as string) || '';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    const rawData = atob(base64);
    const arr = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
    return arr.buffer as ArrayBuffer;
}

export type PushState =
    | 'unsupported' // browser doesn't support Push API
    | 'denied' // user blocked notifications
    | 'subscribed' // active push subscription exists
    | 'unsubscribed' // supported but not subscribed
    | 'loading'; // checking state

async function getCurrentState(): Promise<PushState> {
    if (
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
    ) {
        return 'unsupported';
    }
    if (Notification.permission === 'denied') return 'denied';
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    return existing ? 'subscribed' : 'unsubscribed';
}

export function usePushSubscription() {
    const [state, setState] = useState<PushState>('loading');

    useEffect(() => {
        getCurrentState().then(setState);
    }, []);

    const subscribe = useCallback(async (): Promise<boolean> => {
        if (!VAPID_PUBLIC_KEY) {
            console.error('[push] VITE_VAPID_PUBLIC_KEY is not set');
            return false;
        }
        try {
            setState('loading');
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                setState('denied');
                return false;
            }
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });
            const json = sub.toJSON();
            const token = localStorage.getItem('accessToken') || '';
            const resp = await fetch(
                `${API_BASE}/register/professionals/push-subscription/`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({
                        endpoint: json.endpoint,
                        p256dh: json.keys?.p256dh,
                        auth: json.keys?.auth,
                    }),
                },
            );
            if (!resp.ok) {
                console.error(
                    '[push] Server rejected subscription:',
                    resp.status,
                );
                await sub.unsubscribe();
                setState('unsubscribed');
                return false;
            }
            setState('subscribed');
            return true;
        } catch (err) {
            console.error('[push] subscribe failed:', err);
            setState(await getCurrentState());
            return false;
        }
    }, []);

    const unsubscribe = useCallback(async (): Promise<boolean> => {
        try {
            setState('loading');
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            if (sub) {
                const token = localStorage.getItem('accessToken') || '';
                await fetch(
                    `${API_BASE}/register/professionals/push-subscription/`,
                    {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(token
                                ? { Authorization: `Bearer ${token}` }
                                : {}),
                        },
                        body: JSON.stringify({ endpoint: sub.endpoint }),
                    },
                );
                await sub.unsubscribe();
            }
            setState('unsubscribed');
            return true;
        } catch (err) {
            console.error('[push] unsubscribe failed:', err);
            setState(await getCurrentState());
            return false;
        }
    }, []);

    return { state, subscribe, unsubscribe };
}
