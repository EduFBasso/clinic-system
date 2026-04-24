import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClientPendingState } from '../useClientPendingState';

// Minimal mutable test type approximating ClientBasic subset used by the hook
interface TestClient {
    id: number;
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
    next_appointment_status?: 'scheduled' | 'pending' | 'done' | 'canceled' | null;
    next_appointment_start_at?: string | null;
    next_appointment_end_at?: string | null;
    next_appointment_id?: number | null;
    next_appointment_title?: string | null;
    next_appointment_notes?: string | null;
    last_appointment_status?: 'scheduled' | 'pending' | 'done' | 'canceled' | null;
    has_pending_appointment?: boolean; // optional future flag
}

const baseClient: TestClient = {
    id: 1,
    first_name: 'Test',
    last_name: 'Client',
    phone: '000',
    email: 't@example.com',
    next_appointment_status: 'pending',
    next_appointment_start_at: new Date(
        Date.now() - 30 * 60 * 1000,
    ).toISOString(),
    next_appointment_end_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    next_appointment_id: 10,
    next_appointment_title: 'Sessão',
    next_appointment_notes: 'Notas',
};

describe('useClientPendingState', () => {
    it('delays entering pending (hysteresis)', () => {
        vi.useFakeTimers();
        const now = new Date();
        const { result } = renderHook(() =>
            useClientPendingState({ client: baseClient as TestClient, now }),
        );
        expect(result.current.effectivePending).toBe(false);
        act(() => {
            vi.advanceTimersByTime(150); // > 140ms delay
        });
        act(() => {});
        expect(result.current.effectivePending).toBe(true);
        vi.useRealTimers();
    });

    it('exits pending immediately when status changes', async () => {
        vi.useFakeTimers();
        const now = new Date();
        const { result, rerender } = renderHook(
            ({ client }: { client: TestClient }) =>
                useClientPendingState({ client, now }),
            {
                initialProps: { client: baseClient },
            },
        );
        act(() => {
            vi.advanceTimersByTime(200);
        });
        act(() => {});
        expect(result.current.effectivePending).toBe(true);
        // Change status to done (simulating finalize)
        const updated: TestClient = {
            ...baseClient,
            next_appointment_status: 'done',
        };
        rerender({ client: updated });
        // Should drop immediately (no delay on exit)
        expect(result.current.effectivePending).toBe(false);
        vi.useRealTimers();
    });
});
