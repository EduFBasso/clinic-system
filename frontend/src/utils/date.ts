export function toISODate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

export function formatDateTime(iso?: string) {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        const dd = d.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
        });
        const hh = d.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
        });
        return `${dd} ${hh}`;
    } catch {
        return iso;
    }
}
