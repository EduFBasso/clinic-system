import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClientCard } from '../clientCard/ClientCard';
import type { ClientBasic } from '../../types/ClientBasic';

// Mock focus util to avoid scroll logic noise
vi.mock('../../utils/focusClientCard', () => ({
    focusClientCard: () => {},
}));

// Simplified mock for hook dependencies that might rely on timers/network
vi.mock('../../hooks/useFinalizeAppointment', () => ({
    useFinalizeAppointment: () => ({ finishing: false, finalize: vi.fn() }),
}));
// Mock fetch de pendência para cenário com janela futura
vi.mock('../../services/pending', () => ({
    findFirstPendingForClient: vi.fn(async () => ({
        id: 555,
        start_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        end_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        status: 'scheduled',
        title: 'Sessão passada correta',
        notes: 'Notas',
        client: 1,
        client_name: 'Maria Silva',
    })),
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

    it('exibe bloco de pendência compacto (Status + texto) sem ícones de agendar quando pendente isolado', async () => {
        vi.useFakeTimers();
        // next_appointment_status: 'pending' triggers isPendingHeuristic in useClientPendingState
        const client = makeClient({ next_appointment_status: 'pending' });
        const onView = vi.fn();
        const listener = vi.fn();
        window.addEventListener(
            'pendingActions:open',
            listener as EventListener,
        );
        render(<MemoryRouter><ClientCard client={client} onView={onView} /></MemoryRouter>);
        await act(async () => {
            vi.advanceTimersByTime(200); // surpass hysteresis 140ms
        });
        // Use synchronous query after flushing timers to avoid waitFor with fake timers
        const pendingText = screen.getByText('Compromisso pendente');
        expect(pendingText).toBeInTheDocument();
        // Não deve haver botão + ou calendário enquanto pendente
        expect(
            screen.queryByTitle(/Novo agendamento|Agenda mensal/i),
        ).toBeNull();
        // Usa createAction fallback internamente: título para resolver pendência NÃO aparece como botão +
        // Acionamos a resolução via SolveButton (que não tem title específico; buscamos por role button contendo texto 'Solucionar' se houver)
        const solveBtn = screen.getByTitle('Resolver pendência');
        fireEvent.click(solveBtn);
        expect(listener).toHaveBeenCalledOnce();
    });

    it('exibe bloco de pendência mesmo com compromisso futuro (flag has_pending_appointment) e sem ícones de agendar', async () => {
        vi.useFakeTimers();
        const futureStart = new Date(Date.now() + 60 * 60 * 1000);
        const futureEnd = new Date(Date.now() + 90 * 60 * 1000);
        const client = makeClient({
            next_appointment_start_at: futureStart.toISOString(),
            next_appointment_end_at: futureEnd.toISOString(),
            // Mantemos status null para forçar linha fallback; flag garante effectivePending
            next_appointment_status: null,
            next_appointment_id: 999,
            // @ts-expect-error forward-compatible test field (campo ainda não tipado)
            has_pending_appointment: true,
        });
        const listener = vi.fn();
        window.addEventListener(
            'pendingActions:open',
            listener as EventListener,
        );
        render(<MemoryRouter><ClientCard client={client} onView={() => {}} /></MemoryRouter>);
        await act(async () => {
            vi.advanceTimersByTime(200);
        });
        const pendingText = screen.getByText('Compromisso pendente');
        expect(pendingText).toBeInTheDocument();
        expect(
            screen.queryByTitle(/Novo agendamento|Agenda mensal/i),
        ).toBeNull();
        const solveBtn = screen.getByTitle('Resolver pendência');
        await act(async () => {
            fireEvent.click(solveBtn);
            // Avança timers para permitir fetch mock assíncrono e dispatch
            vi.advanceTimersByTime(10);
        });
        expect(listener).toHaveBeenCalled();
    });

    it('não mostra bloco de pendência quando scheduled e não está pendente', () => {
        const client = makeClient({
            next_appointment_status: 'scheduled',
            next_appointment_start_at: new Date(
                Date.now() + 30 * 60 * 1000,
            ).toISOString(),
            next_appointment_end_at: new Date(
                Date.now() + 60 * 60 * 1000,
            ).toISOString(),
        });
        render(<MemoryRouter><ClientCard client={client} onView={() => {}} /></MemoryRouter>);
        expect(screen.queryByText('Compromisso pendente')).toBeNull();
    });
    // Botão específico de resolver foi removido; a ação agora está no +
});
