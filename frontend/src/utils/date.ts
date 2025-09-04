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
