// Safe device id generator with fallbacks for older mobile browsers
export function getOrCreateDeviceId(key = 'device_id'): string {
    try {
        const existing = localStorage.getItem(key);
        if (existing && existing.length > 0) return existing;
    } catch {
        // ignore localStorage errors; fallback to in-memory id
    }

    const uuid = generateUuidFallback();
    try {
        localStorage.setItem(key, uuid);
    } catch {
        // ignore storage failures
    }
    return uuid;
}

type CryptoLike = {
    randomUUID?: () => string;
    getRandomValues?: (array: Uint8Array) => Uint8Array;
};

function getCrypto(): CryptoLike | undefined {
    const g: unknown =
        typeof globalThis !== 'undefined' ? globalThis : undefined;
    if (!g || typeof g !== 'object') return undefined;
    const maybeCrypto = (g as Record<string, unknown>).crypto;
    if (maybeCrypto && typeof maybeCrypto === 'object') {
        return maybeCrypto as CryptoLike;
    }
    return undefined;
}

function generateUuidFallback(): string {
    // Prefer native randomUUID
    try {
        const c = getCrypto();
        if (c && typeof c.randomUUID === 'function') {
            return c.randomUUID!();
        }
    } catch {
        // ignore
    }

    // RFC4122-ish v4 fallback using getRandomValues when available
    const getRandom = (): number => {
        try {
            const c = getCrypto();
            if (c && typeof c.getRandomValues === 'function') {
                const buf = new Uint8Array(1);
                c.getRandomValues!(buf);
                return buf[0] / 255;
            }
        } catch {
            // ignore
        }
        return Math.random();
    };

    const hex = (n: number) => (n | 0).toString(16).padStart(2, '0');
    const segment = (len: number) =>
        Array.from({ length: len }, () => hex(getRandom() * 256)).join('');

    // 8-4-4-4-12
    return (
        segment(4) +
        segment(4) +
        '-' +
        segment(2) +
        '-' +
        segment(2) +
        '-' +
        segment(2) +
        '-' +
        segment(6)
    );
}
