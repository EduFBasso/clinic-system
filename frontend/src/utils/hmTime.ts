/** Zero-pads a number to 2 digits. */
export function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

/** Converts "HH:MM" string to total minutes. */
export function toMinutes(hm: string): number {
    const [h, m] = hm.split(':').map(s => parseInt(s || '0', 10));
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

/** Converts total minutes to "HH:MM" string. */
export function fromMinutes(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${pad2(h)}:${pad2(m)}`;
}

/** Short weekday label in pt-BR, capitalised (e.g. "Ter"). */
export function weekdayLabel(d: Date): string {
    const s = d
        .toLocaleDateString('pt-BR', { weekday: 'short' })
        .replace('.', '');
    return s.charAt(0).toUpperCase() + s.slice(1);
}
