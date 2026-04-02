import { describe, it, expect } from 'vitest';
import { getNextAppointment, relativeLabel } from '../getNextAppointment';
import type { AppointmentLike } from '../getNextAppointment';

function ap(partial: Partial<AppointmentLike>): AppointmentLike {
    const base: AppointmentLike = {
        id: 1,
        title: 'Sessão',
        start_at: new Date().toISOString(),
        end_at: new Date(Date.now() + 60 * 60000).toISOString(),
        status: 'scheduled',
    } as AppointmentLike; // override abaixo
    return { ...base, ...partial } as AppointmentLike;
}

describe('getNextAppointment', () => {
    const now = new Date('2025-01-01T12:00:00.000Z');

    it('returns null for empty list', () => {
        expect(getNextAppointment([], now)).toBeNull();
    });

    it('picks future earliest', () => {
        const a = ap({
            id: 1,
            start_at: '2025-01-01T13:00:00.000Z',
            end_at: '2025-01-01T14:00:00.000Z',
        });
        const b = ap({
            id: 2,
            start_at: '2025-01-01T15:00:00.000Z',
            end_at: '2025-01-01T16:00:00.000Z',
        });
        expect(getNextAppointment([b, a], now)?.id).toBe(1);
    });

    it('includes ongoing if includeOngoing=true (default)', () => {
        const ongoing = ap({
            id: 3,
            start_at: '2025-01-01T11:30:00.000Z',
            end_at: '2025-01-01T12:30:00.000Z',
        });
        const future = ap({
            id: 4,
            start_at: '2025-01-01T12:45:00.000Z',
            end_at: '2025-01-01T13:15:00.000Z',
        });
        expect(getNextAppointment([future, ongoing], now)?.id).toBe(3);
    });

    it('skips ongoing if includeOngoing=false', () => {
        const ongoing = ap({
            id: 5,
            start_at: '2025-01-01T11:30:00.000Z',
            end_at: '2025-01-01T12:30:00.000Z',
        });
        const future = ap({
            id: 6,
            start_at: '2025-01-01T12:45:00.000Z',
            end_at: '2025-01-01T13:15:00.000Z',
        });
        expect(
            getNextAppointment([future, ongoing], now, {
                includeOngoing: false,
            })?.id,
        ).toBe(6);
    });

    it('ignores non-scheduled when onlyScheduled=true', () => {
        const canceled = ap({
            id: 7,
            status: 'canceled',
            start_at: '2025-01-01T12:10:00.000Z',
            end_at: '2025-01-01T12:40:00.000Z',
        });
        const future = ap({
            id: 8,
            start_at: '2025-01-01T13:00:00.000Z',
            end_at: '2025-01-01T13:30:00.000Z',
        });
        expect(getNextAppointment([canceled, future], now)?.id).toBe(8);
    });

    it('returns null if all finished', () => {
        const past = ap({
            id: 9,
            start_at: '2025-01-01T10:00:00.000Z',
            end_at: '2025-01-01T11:00:00.000Z',
        });
        expect(getNextAppointment([past], now)).toBeNull();
    });
});

describe('relativeLabel', () => {
    const now = new Date('2025-01-01T12:00:00.000Z');
    it('returns "em X min" for future', () => {
        const appt = ap({
            start_at: '2025-01-01T12:30:00.000Z',
            end_at: '2025-01-01T13:00:00.000Z',
        });
        expect(relativeLabel(appt, now)).toBe('em 30 min');
    });
    it('returns "agora" for ongoing', () => {
        const appt = ap({
            start_at: '2025-01-01T11:50:00.000Z',
            end_at: '2025-01-01T12:10:00.000Z',
        });
        expect(relativeLabel(appt, now)).toBe('agora');
    });
    it('returns terminou há X min for just finished', () => {
        const appt = ap({
            start_at: '2025-01-01T11:00:00.000Z',
            end_at: '2025-01-01T11:55:00.000Z',
        });
        expect(relativeLabel(appt, now)).toBe('terminou há 5 min');
    });
});
