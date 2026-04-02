// Centraliza formatação de horários para futura troca fácil entre local/UTC.
// Uso inicial: formatTime(iso, { mode: 'local' }) -> 'HH:MM'
// Futuro: suportar segundos, sufixos, etc.

export type TimeFormatMode = 'local' | 'utc';

export interface FormatTimeOptions {
    mode?: TimeFormatMode; // default 'local'
    locale?: string; // default 'pt-BR'
}

export function formatTime(
    iso: string | Date | null | undefined,
    opts: FormatTimeOptions = {},
): string {
    if (!iso) return '';
    const { mode = 'local', locale = 'pt-BR' } = opts;
    const d = iso instanceof Date ? iso : new Date(iso);
    if (!isFinite(d.getTime())) return '';
    if (mode === 'utc') {
        const hh = String(d.getUTCHours()).padStart(2, '0');
        const mm = String(d.getUTCMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    }
    // Local: usar toLocaleTimeString com apenas hora/minuto para respeitar 12/24h do locale
    try {
        return d.toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    }
}

export function formatRange(
    startISO: string | Date | null | undefined,
    endISO: string | Date | null | undefined,
    opts: FormatTimeOptions = {},
): string {
    const a = formatTime(startISO, opts);
    const b = formatTime(endISO, opts);
    if (!a && !b) return '';
    if (!b) return a;
    return `${a} – ${b}`;
}

// Helper para comparar se duas strings ISO representam mesmo minuto (ignorando segundos) — útil em pills.
export function sameMinute(a?: string | null, b?: string | null): boolean {
    if (!a || !b) return false;
    try {
        const da = new Date(a);
        const db = new Date(b);
        if (!isFinite(da.getTime()) || !isFinite(db.getTime())) return false;
        return (
            da.getFullYear() === db.getFullYear() &&
            da.getMonth() === db.getMonth() &&
            da.getDate() === db.getDate() &&
            da.getHours() === db.getHours() &&
            da.getMinutes() === db.getMinutes()
        );
    } catch {
        return false;
    }
}
