/**
 * Currency utilities for pt-BR locale.
 * Handles parsing (accepts , or .) and formatting (1.000,00 pattern).
 */

/** Parse string or number to numeric value. Accepts comma or period as decimal separator. */
export function parseAmount(value?: number | string | null): number | null {
    if (value == null) return null;
    if (typeof value === 'number') return Number.isNaN(value) ? null : value;
    
    const normalized = String(value)
        .trim()
        .replace(',', '.'); // normalize comma → period for parsing
    
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? null : parsed;
}

/** Format number as BRL currency (pt-BR: 1.000,00 pattern). */
export function formatBRLCurrency(value?: number | null): string {
    if (value == null) return '-';
    try {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2,
        }).format(value);
    } catch {
        // Fallback
        return `R$ ${value.toFixed(2).replace('.', ',')}`;
    }
}

/** Format amount: parse then format as BRL. */
export function formatAmount(value?: number | string | null): string {
    const numeric = parseAmount(value);
    if (numeric == null) return '-';
    return formatBRLCurrency(numeric);
}

/** Format input value for display (allows user to see what they typed in comma format). */
export function formatInputAmount(value: string): string {
    if (!value) return '';
    // Just return as-is; input accepts both , and .
    return value;
}

/** Validate amount string. Returns { valid, message, numericValue }. */
export function validateAmount(value: string, fieldName = 'Valor'): {
    valid: boolean;
    message?: string;
    numericValue?: number;
} {
    const numeric = parseAmount(value);
    if (numeric === null) {
        return { valid: false, message: `${fieldName} inválido. Use um número maior ou igual a zero.` };
    }
    if (numeric < 0) {
        return { valid: false, message: `${fieldName} não pode ser negativo.` };
    }
    return { valid: true, numericValue: numeric };
}
