// Máscara progressiva para telefone brasileiro (formato: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX)
export function formatPhone(value?: string | null): string {
    if (!value) return '';
    const digits = value.replace(/\D/g, '');
    // Se vier em E.164 BR (55 + DDD + número), remove o código do país só para exibição local.
    const cleaned =
        digits.length > 11 && digits.startsWith('55')
            ? digits.slice(2)
            : digits;
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
