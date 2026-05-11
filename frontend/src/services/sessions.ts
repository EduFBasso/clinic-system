// Lightweight helper to ensure a device session exists for the current user.
// Calls /sessions/summary which lazily creates a DeviceSession when X-Device-Id is present.
// Safe to call multiple times; internally debounced.

import { apiFetch } from '../utils/apiFetch';
import { getAccessToken } from '../utils/auth/session';

let lastAttempt = 0;
let inflight: Promise<void> | null = null;
const COOLDOWN_MS = 10_000; // avoid spamming

export async function ensureDeviceSession(force = false): Promise<void> {
    const now = Date.now();
    if (!force && now - lastAttempt < COOLDOWN_MS) {
        return inflight ?? Promise.resolve();
    }
    lastAttempt = now;
    // If no token, nothing to ensure
    const token =
        typeof window !== 'undefined'
            ? getAccessToken()
            : null;
    if (!token) return;
    inflight = (async () => {
        try {
            await apiFetch('/sessions/summary', { suppressAutoLogout: true });
        } catch {
            // Swallow errors – creation is best-effort. Caller will proceed anyway.
        } finally {
            inflight = null;
        }
    })();
    return inflight;
}

export default ensureDeviceSession;
