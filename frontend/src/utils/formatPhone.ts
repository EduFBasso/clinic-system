// Máscara progressiva para telefone brasileiro (formato: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX)
export function formatPhone(value?: string | null): string {
    if (!value) return '';
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 2) {
        return cleaned;
    }
    if (cleaned.length <= 6) {
        return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
    }
    if (cleaned.length <= 10) {
        return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(
            6,
        )}`;
    }
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(
        7,
        11,
    )}`;
}
