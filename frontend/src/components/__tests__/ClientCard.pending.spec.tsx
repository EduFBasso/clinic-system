import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ClientCard from '../ClientCard';
import type { ClientBasic } from '../../types/ClientBasic';

// Mock focus util to avoid scroll logic noise
vi.mock('../../utils/focusClientCard', () => ({
    focusClientCard: () => {},
}));

// Simplified mock for hook dependencies that might rely on timers/network
vi.mock('../../hooks/useFinalizeAppointment', () => ({
    useFinalizeAppointment: () => ({ finishing: false, finalize: vi.fn() }),
}));
vi.mock('../../hooks/useOngoingSnapshot', () => ({
    useOngoingSnapshot: () => ({ snapshot: null }),
}));
vi.mock('../../hooks/useOngoingSweep', () => ({
    useOngoingSweep: () => new Map(),
}));
vi.mock('../../hooks/useOngoingLatch', () => ({
    useOngoingLatch: () => ({
        latched: null,
        setLatched: () => {},
        clear: () => {},
    }),
    readOngoingLatch: () => null,
}));
vi.mock('../../hooks/useVisibilityResumeGrace', () => ({
    useVisibilityResumeGrace: () => false,
}));
vi.mock('../../hooks/useAppointmentCardState.ts', () => ({
    useAppointmentCardState: () => ({ isOngoing: false }),
}));

// Ensure events don't break tests
beforeEach(() => {
    localStorage.clear();
});

describe('ClientCard pending state', () => {
    function makeClient(overrides: Partial<ClientBasic> = {}): ClientBasic {
        return {
            id: 1,
            first_name: 'Maria',
            last_name: 'Silva',
            phone: '11999999999',
            date_of_birth: '',
            address: '',
            address_number: '',
            email: '',
            photo: '',
            next_appointment_id: 10,
            next_appointment_title: 'Consulta',
            next_appointment_start_at: new Date(
                Date.now() - 60 * 60 * 1000,
            ).toISOString(), // 1h atrás
            next_appointment_end_at: new Date(
                Date.now() - 30 * 60 * 1000,
            ).toISOString(), // 30min atrás (janela encerrada)
            // IMPORTANT: para testar fallback 'Compromisso pendente' precisamos NÃO estar em estado scheduled
            // usamos null para indicar ausência de próximo agendamento (assim cai no bloco fallback Data)
            next_appointment_status: null,
            next_appointment_notes: 'Anotar pressão',
            ...overrides,
        };
    }

    it('exibe texto "Compromisso pendente" na linha Data (fallback) e + abre pendingActions (sem scheduled atual)', () => {
        const client = makeClient(); // status 'none' + janela encerrada => heurística pendente isolado
        const onView = vi.fn();
        const listener = vi.fn();
        window.addEventListener(
            'pendingActions:open',
            listener as EventListener,
        );
        render(<ClientCard client={client} onView={onView} />);

        // Texto na linha Data
        const pendingText = screen.getByText('Compromisso pendente');
        expect(pendingText).toBeInTheDocument();

        // Botão + com título de resolver pendência
        const plus = screen.getAllByTitle(
            /Resolver pendência deste cliente/i,
        )[0] as HTMLButtonElement;
        expect(plus.disabled).toBe(false);
        fireEvent.click(plus);
        expect(listener).toHaveBeenCalledOnce();
    });

    it('detecta pendência via flag has_pending_appointment mesmo com compromisso futuro (fallback isolado ausente, então força uso da flag => ajustar para não scheduled)', () => {
        const futureStart = new Date(Date.now() + 60 * 60 * 1000);
        const futureEnd = new Date(Date.now() + 90 * 60 * 1000);
        const client = makeClient({
            next_appointment_start_at: futureStart.toISOString(),
            next_appointment_end_at: futureEnd.toISOString(),
            // Mantemos status null para forçar linha fallback; flag garante effectivePending
            next_appointment_status: null,
            // @ts-expect-error forward-compatible test field (campo ainda não tipado)
            has_pending_appointment: true,
        });
        const listener = vi.fn();
        window.addEventListener(
            'pendingActions:open',
            listener as EventListener,
        );
        render(<ClientCard client={client} onView={() => {}} />);
        const pendingText = screen.getByText('Compromisso pendente');
        expect(pendingText).toBeInTheDocument();
        const plus = screen.getAllByTitle(
            /Resolver pendência deste cliente/i,
        )[0];
        fireEvent.click(plus);
        expect(listener).toHaveBeenCalledOnce();
    });

    it('não mostra "Compromisso pendente" quando ainda há próximo agendamento scheduled (texto fallback suprimido)', () => {
        const client = makeClient({
            next_appointment_status: 'scheduled',
        });
        render(<ClientCard client={client} onView={() => {}} />);
        // A linha fallback de Data não deve aparecer, portanto o texto não é encontrado
        expect(screen.queryByText('Compromisso pendente')).toBeNull();
    });
    // Botão específico de resolver foi removido; a ação agora está no +
});
