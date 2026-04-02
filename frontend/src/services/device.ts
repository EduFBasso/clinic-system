/**
 * Best-effort device identification used to tag finalize actions.
 *
 * We generate and persist a random device_id and include coarse info
 * about platform, userAgent, and screen. No PII.
 *
 * IMPORTANT: The backend enforces an active device session for the
 * provided device id. We must use the SAME storage key as the code
 * that creates sessions (utils/getOrCreateDeviceId with key 'device_id').
 * Below we migrate any legacy key to the new canonical key.
 */

import { getOrCreateDeviceId } from '../utils/device';

const LEGACY_LS_DEVICE_ID = 'device.id.v1';

export function getDeviceId(): string {
    try {
        // Migrate legacy key -> canonical key used by ensureDeviceSession/apiFetch
        const current = localStorage.getItem('device_id');
        if (current && current.length > 0) return current;
        const legacy = localStorage.getItem(LEGACY_LS_DEVICE_ID);
        if (legacy && legacy.length > 0) {
            try {
                localStorage.setItem('device_id', legacy);
            } catch {
                /* ignore */
            }
            return legacy;
        }
    } catch {
        // ignore storage errors
    }
    // Fallback to generator (persists under 'device_id')
    return getOrCreateDeviceId('device_id');
}

export function getDeviceInfo(): Record<string, unknown> {
    const nav: Partial<Navigator> =
        typeof navigator !== 'undefined' ? navigator : {};
    const scr: Partial<Screen> = typeof screen !== 'undefined' ? screen : {};
    return {
        platform: nav.platform || null,
        userAgent: nav.userAgent || null,
        language: (nav as { language?: string }).language || null,
        languages: (nav as { languages?: readonly string[] }).languages || null,
        screen: scr
            ? {
                  width: scr.width,
                  height: scr.height,
                  pixelRatio:
                      typeof window !== 'undefined'
                          ? window.devicePixelRatio || 1
                          : 1,
              }
            : null,
    };
}

export function buildDeviceHeaders(): Record<string, string> {
    const info = getDeviceInfo();
    return {
        'x-device-id': getDeviceId(),
        'x-device-info': encodeURIComponent(JSON.stringify(info)),
    };
}
