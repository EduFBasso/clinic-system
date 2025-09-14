// Utilidades para lidar com date_of_birth em formatos dd/mm/YYYY (UI) e ISO YYYY-MM-DD (backend)
// Fornece parse seguro, formatação BR e cálculo de idade.

export interface ParsedDOB {
    iso: string; // YYYY-MM-DD
    day: number; // 1-31
    month: number; // 1-12
    year: number; // 4 dígitos
    age?: number | null; // idade calculada (se válida e dentro de faixa)
}

const ISO_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const BR_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export function isValidDateParts(y: number, m: number, d: number): boolean {
    if (y < 1900 || y > 2100) return false; // faixa razoável
    if (m < 1 || m > 12) return false;
    if (d < 1 || d > 31) return false;
    const dt = new Date(y, m - 1, d);
    return (
        dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
    );
}

export function calcAge(
    y: number,
    m: number,
    d: number,
    today = new Date(),
): number | null {
    if (!isValidDateParts(y, m, d)) return null;
    let age = today.getFullYear() - y;
    const mdiff = today.getMonth() - (m - 1);
    if (mdiff < 0 || (mdiff === 0 && today.getDate() < d)) age--;
    if (age < 0 || age > 129) return null;
    return age;
}

export function parseDOB(raw: string): ParsedDOB | null {
    if (!raw) return null;
    let y: number, m: number, d: number;
    if (ISO_REGEX.test(raw)) {
        const [, yy, mm, dd] = raw.match(ISO_REGEX)!;
        y = parseInt(yy, 10);
        m = parseInt(mm, 10);
        d = parseInt(dd, 10);
    } else if (BR_REGEX.test(raw)) {
        const [, dd, mm, yy] = raw.match(BR_REGEX)!;
        d = parseInt(dd, 10);
        m = parseInt(mm, 10);
        y = parseInt(yy, 10);
    } else {
        return null;
    }
    if (!isValidDateParts(y, m, d)) return null;
    const iso = `${y.toString().padStart(4, '0')}-${m
        .toString()
        .padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    return {
        iso,
        day: d,
        month: m,
        year: y,
        age: calcAge(y, m, d) ?? undefined,
    };
}

export function formatDOBToBR(raw?: string | null): string | null {
    if (!raw) return null;
    const parsed = parseDOB(raw);
    if (!parsed) return null;
    return `${String(parsed.day).padStart(2, '0')}/${String(
        parsed.month,
    ).padStart(2, '0')}/${parsed.year}`;
}

export function normalizeDOBForApi(raw?: string | null): string | null {
    if (!raw) return null;
    const parsed = parseDOB(raw);
    return parsed ? parsed.iso : null;
}

export function formatDOBWithAge(raw?: string | null): string | null {
    const parsed = parseDOB(raw || '');
    if (!parsed) return null;
    const br = `${String(parsed.day).padStart(2, '0')}/${String(
        parsed.month,
    ).padStart(2, '0')}/${parsed.year}`;
    if (parsed.age != null) return `${br} (${parsed.age} anos)`;
    return br;
}
