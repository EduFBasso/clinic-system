// Minimal JWT helpers for client-side validation
export interface JwtPayload {
    exp?: number; // seconds since epoch
    [key: string]: unknown;
}

// Decode a JWT payload safely (handles URL-safe base64). Returns null on error.
export function decodeJwt(token: string): JwtPayload | null {
    try {
        const parts = token.split('.');
        if (parts.length < 2) return null;
        const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=');
        const json = atob(padded);
        return JSON.parse(json);
    } catch {
        return null;
    }
}

// Returns true when token is missing/invalid or exp is in the past (with optional clock skew)
export function isTokenExpired(
    token: string | null | undefined,
    skewSeconds = 30,
): boolean {
    if (!token) return true;
    const payload = decodeJwt(token);
    if (!payload || typeof payload.exp !== 'number') return true;
    const nowSec = Math.floor(Date.now() / 1000);
    return payload.exp <= nowSec + skewSeconds;
}
