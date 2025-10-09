import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import MonthlyAgendaModal from '../../components/MonthlyAgendaModal';
import type { ClientBasic } from '../../types/ClientBasic';

vi.mock('../../hooks/useAppointments', () => ({
    useAppointmentsRange: vi
        .fn()
        .mockReturnValue({ items: [], loading: false }),
}));

const client: ClientBasic = {
    id: 1,
    first_name: 'Maria',
    last_name: 'Oliveira',
    phone: '',
    email: '',
};

describe('MonthlyAgendaModal header UX (unified simplified)', () => {
    beforeEach(() => {
        // Reset scroll position mocks if needed
        const g = globalThis as unknown as {
            ResizeObserver?: typeof ResizeObserver;
        };
        if (!g.ResizeObserver) {
            g.ResizeObserver = class {
                observe() {}
                disconnect() {}
            } as unknown as typeof ResizeObserver;
        }
    });
    it('renders Hoje button + calendar icon + month selector', () => {
        render(<MonthlyAgendaModal open onClose={() => {}} client={client} />);
        // Hoje button
        expect(
            screen.getByRole('button', { name: /ir para hoje/i }),
        ).toBeInTheDocument();
        // Calendar icon button (aria-label Abrir calendário)
        expect(
            screen.getByRole('button', { name: /abrir calendário/i }),
        ).toBeInTheDocument();
        // Month selector button (aria-label Selecionar mês)
        expect(
            screen.getByRole('button', { name: /selecionar mês/i }),
        ).toBeInTheDocument();
    });
    it('Hoje button jumps to current month if different', () => {
        // Start from an arbitrary past month
        const past = new Date('2025-01-15T12:00:00Z');
        render(
            <MonthlyAgendaModal
                open
                onClose={() => {}}
                client={client}
                initialMonth={past}
            />,
        );
        const todayBtn = screen.getByRole('button', { name: /ir para hoje/i });
        fireEvent.click(todayBtn);
        // After click, month selector button should reflect current month/year
        const now = new Date();
        const currentMonthName = now
            .toLocaleString('pt-BR', { month: 'long' })
            .charAt(0)
            .toUpperCase();
        const monthBtn = screen.getByRole('button', {
            name: /selecionar mês/i,
        });
        expect(monthBtn.textContent).toMatch(new RegExp(currentMonthName, 'i'));
    });
});
