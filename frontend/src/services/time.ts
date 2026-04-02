import { API_BASE } from '../config/api';

/**
 * Fetches the current server time once.
 * Primary source: /health/full JSON "time" field.
 * Fallback: HTTP Date header.
 */
export async function getServerNowOnce(): Promise<Date | null> {
    try {
        const res = await fetch(`${API_BASE}/health/full`, {
            method: 'GET',
            cache: 'no-store',
            credentials: 'omit',
        });
        if (res.ok) {
            try {
                const json = (await res.json()) as { time?: string };
                if (json && typeof json.time === 'string') {
                    const d = new Date(json.time);
                    if (!Number.isNaN(d.getTime())) return d;
                }
            } catch {
                // ignore json parse error and try Date header
            }
            const hdr = res.headers.get('Date');
            if (hdr) {
                const d = new Date(hdr);
                if (!Number.isNaN(d.getTime())) return d;
            }
        }
    } catch {
        /* ignore */
    }
    return null;
}
