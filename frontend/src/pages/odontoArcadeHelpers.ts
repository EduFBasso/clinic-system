// Types and pure helpers shared by OdontoArcadePage and its sub-components.
// Keep this file free of React imports and side-effects.

import { parseAmount, formatBRLCurrency, toInputAmount } from '../utils/currency';
import { getNow } from '../utils/now';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ArcadeListItem = {
    id: number;
    status: 'pending' | 'completed';
    updated_at?: string;
    pending_procedures?: number;
    completed_procedures?: number;
};

export type ToothItem = {
    id: number;
    sequence: number;
    international_number: number;
};

export type ProcedureItem = {
    id: number;
    tooth: number | null;
    parent_procedure: number | null;
    is_product: boolean;
    status: 'pending' | 'completed' | 'canceled';
    name: string;
    code?: string;
    faces_raw?: string | null;
    patient_amount?: number | string | null;
    paid_amount?: number | string | null;
    paid_at?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    notes?: string;
    is_active: boolean;
};

export type EditProductItem = {
    id?: number;
    name: string;
    value: string;
    saveNameToList: boolean;
    saveValueToList: boolean;
    showDropdown: boolean;
};

export type ProcedureFormKind = 'tooth' | 'general';

export type ServiceFlowType = 'tooth' | 'arcade' | 'other';

export type ServiceRow = {
    toothId: number | null;
    phase: string;
    treatment: string;
    value: string;
    notes: string;
};

export type ProductRow = {
    name: string;
    value: string;
    notes: string;
};

export type ProductCatalogItem = {
    name: string;
    last_value: string | null;
};

export type ProcedureGroup = {
    key: string;
    label: string;
    procedures: ProcedureItem[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const INTERNATIONAL_NUMBERS = [
    18, 17, 16, 15, 14, 13, 12, 11,
    21, 22, 23, 24, 25, 26, 27, 28,
    48, 47, 46, 45, 44, 43, 42, 41,
    31, 32, 33, 34, 35, 36, 37, 38,
];

export const PHASE_OPTIONS: Array<{ value: string; label: string }> = [
    { value: '', label: 'Opcional' },
    { value: 'O', label: 'Oclusal' },
    { value: 'V', label: 'Vestibular' },
    { value: 'P', label: 'Palatino' },
    { value: 'M', label: 'Mesial' },
    { value: 'D', label: 'Distal' },
    { value: 'MO', label: 'Mesio-oclusal' },
    { value: 'DO', label: 'Disto-oclusal' },
    { value: 'VO', label: 'Vestibulo-oclusal' },
    { value: 'PO', label: 'Palatino-oclusal' },
    { value: 'MDO', label: 'Mesio-disto-oclusal' },
];

export const ARCADE_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'SUPERIOR', label: 'Superior' },
    { value: 'INFERIOR', label: 'Inferior' },
    { value: 'AMBAS', label: 'Superior e Inferior' },
];

// ─── Pure utilities ───────────────────────────────────────────────────────────

export function asList<T>(payload: unknown): T[] {
    if (Array.isArray(payload)) return payload as T[];
    if (
        payload &&
        typeof payload === 'object' &&
        Array.isArray((payload as { results?: unknown[] }).results)
    ) {
        return (payload as { results: T[] }).results;
    }
    return [];
}

export function hasOdontoAccess(): boolean {
    try {
        const stored = localStorage.getItem('loggedProfessional');
        if (!stored) return false;
        const professional = JSON.parse(stored) as { specialty?: string };
        const specialty = (professional.specialty || '')
            .toString()
            .trim()
            .toLowerCase();
        return (
            specialty.includes('odonto') ||
            specialty.includes('dent') ||
            specialty.includes('ortodont')
        );
    } catch {
        return false;
    }
}

export function parseDateLocal(dateIso: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateIso);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(dateIso?: string | null): string {
    if (!dateIso) return '-';
    const d = parseDateLocal(dateIso);
    if (!d) return '-';
    return d.toLocaleDateString('pt-BR');
}

export function formatDateShort(dateIso?: string | null): string {
    if (!dateIso) return '-';
    const d = parseDateLocal(dateIso);
    if (!d) return '-';
    return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
    });
}

export function formatMoney(value?: number | string | null): string {
    if (value == null) return '-';
    const numeric = typeof value === 'string' ? parseAmount(value) : value;
    return formatBRLCurrency(numeric);
}

export function eventDateISO(proc: ProcedureItem): string | null {
    return proc.completed_at || proc.started_at || null;
}

export function isProcedureCompleted(proc: ProcedureItem): boolean {
    return proc.status === 'completed' || !!proc.completed_at;
}

/** Returns today in YYYY-MM-DD using local timezone (avoids UTC-shift at night). */
export function todayISODate(): string {
    const d = getNow();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function normalizeMoneyInput(value: string): string {
    const parsed = parseAmount(value);
    if (parsed == null) return value;
    return toInputAmount(parsed.toFixed(2));
}

export function normalizeSearchText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}
