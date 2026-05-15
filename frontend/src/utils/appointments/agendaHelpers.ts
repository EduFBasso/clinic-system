/**
 * Shared helpers for agenda views (DesktopAgendaPage, DailyAgendaModal).
 * Centralises logic that was duplicated across both components.
 */
import type { ClientBasic } from '../../types/ClientBasic';
import type { EnrichedAppointment } from './status';

/** Order for sorting appointments by status within the same time slot. */
export const STATUS_ORDER = [
    'ongoing',
    'scheduled',
    'done',
    'canceled',
] as const;

export interface ClientLike {
    id: number;
    name: string;
}
export type RawClientField = ClientLike | number | undefined | null;

/** Narrows an unknown value to the { id, name? } shape. */
export function isClientLike(x: unknown): x is { id: number; name?: string } {
    return (
        typeof x === 'object' &&
        x !== null &&
        'id' in (x as Record<string, unknown>) &&
        typeof (x as { id: unknown }).id === 'number'
    );
}

/** Splits a full name string into first / last parts. */
export function splitName(full?: string): { first: string; last: string } {
    if (!full) return { first: 'Cliente', last: '' };
    const parts = full.trim().split(/\s+/);
    if (parts.length === 1) return { first: parts[0], last: '' };
    const last = parts.pop() || '';
    return { first: parts.join(' '), last };
}

/**
 * Builds a minimal ClientBasic from an enriched appointment.
 * Used to open QuickScheduleModal pre-filled with the client.
 */
export function makeClientBasic(
    a: {
        id: number;
        status: 'scheduled' | 'pending' | 'done' | 'canceled' | 'ongoing';
        start_at: string;
        end_at: string;
        client?: ClientLike | number;
        client_name?: string;
        title?: string;
        visit_type?: string;
        notes?: string | null;
    },
): ClientBasic {
    const c = a.client as ClientLike | number | undefined;
    const displayName = (isClientLike(c) && c.name) || a.client_name || '';
    const { first, last } = splitName(displayName);
    let clientId = 0;
    if (typeof c === 'number') clientId = c;
    else if (isClientLike(c)) clientId = c.id;
    return {
        id: clientId,
        first_name: first,
        last_name: last,
        phone: '',
        email: '',
        next_appointment_id: a.id,
        next_appointment_status: a.status,
        next_appointment_start_at: a.start_at,
        next_appointment_end_at: a.end_at,
        next_appointment_title: a.title,
        next_appointment_visit_type:
            a.visit_type as ClientBasic['next_appointment_visit_type'],
        next_appointment_notes: a.notes || null,
    } as ClientBasic;
}

/**
 * Canonical filter predicate for a status filter key.
 * Used by DesktopAgendaPage and DailyAgendaModal so both behave identically.
 *
 * 'active'  → scheduled future (not past, not ongoing)
 * 'past'    → scheduled but past end_at
 * 'ongoing' → currently in progress
 * 'done'    → finalized
 * 'canceled'→ canceled
 * 'all'     → everything
 */
export function matchesStatusFilter(
    filter: 'all' | 'active' | 'past' | 'done' | 'canceled' | 'ongoing',
    a: EnrichedAppointment,
): boolean {
    const status = a.status;
    switch (filter) {
        case 'all':
            return true;
        case 'active':
            return status === 'scheduled' && !a._isPast && !a._isOngoing;
        case 'past':
            return status === 'pending' || (status === 'scheduled' && a._isPast);
        case 'done':
            return status === 'done';
        case 'canceled':
            return status === 'canceled';
        case 'ongoing':
            return a._isOngoing || status === 'ongoing';
        default:
            return true;
    }
}
