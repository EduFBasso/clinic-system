// Simplified: no server-time provider; just return local time.
export function getNow(): Date {
    return new Date();
}
