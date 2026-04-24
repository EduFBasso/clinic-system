import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClientPendingState } from '../useClientPendingState';

// Simula cenário: cliente tem um "next" futuro (semana que vem) mas existe pendência hoje.
// Mock do fetch server-side retorna um compromisso passado para corrigir a janela.

declare global {
    interface WindowEventMap {
        'pendingActions:open': CustomEvent;
    }
}

vi.mock('../../services/pending', () => ({
    findFirstPendingForClient: vi.fn(async () => ({
        id: 777,
        start_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        end_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        status: 'pending',
        title: 'Sessão correta',
        notes: 'Notas',
        client: 153,
        client_name: 'Teste',
    })),
}));

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
    has_pending_appointment?: boolean; // ativará heurística
}

describe('useClientPendingState future mismatch', () => {
    it('abre modal com compromisso passado quando next aponta para futuro', async () => {
        vi.useFakeTimers();
        const now = new Date();
        const client: TestClient = {
            id: 153,
            first_name: 'Cliente',
            last_name: 'Teste',
            phone: '0',
            email: 'c@example.com',
            // Próximo compromisso FUTURO (1 semana)
            next_appointment_status: 'scheduled',
            next_appointment_start_at: new Date(
                Date.now() + 7 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000,
            ).toISOString(),
            next_appointment_end_at: new Date(
                Date.now() + 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000,
            ).toISOString(),
            next_appointment_id: 999,
            next_appointment_title: 'Sessão futura',
            next_appointment_notes: 'Notas futuras',
            // Flag explícita de pendência (existe compromisso passado não resolvido)
            has_pending_appointment: true,
        };

        const { result } = renderHook(() =>
            useClientPendingState({ client: client as TestClient, now }),
        );
        // Avança histerese
        act(() => {
            vi.advanceTimersByTime(200);
        });
        expect(result.current.effectivePending).toBe(true);

        const listener = vi.fn();
        window.addEventListener('pendingActions:open', listener);
        // Aciona abertura
        await result.current.openPendingActions();
        expect(listener).toHaveBeenCalled();
        const detail = (
            listener.mock.calls[0][0] as CustomEvent<{ appointmentId: number }>
        ).detail;
        // Deve ser o compromisso passado mockado (id 777) e não o futuro (id 999)
        expect(detail.appointmentId).toBe(777);
        vi.useRealTimers();
    });
});
