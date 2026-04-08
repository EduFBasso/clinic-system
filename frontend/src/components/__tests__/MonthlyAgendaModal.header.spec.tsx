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
    it('renders Mês Atual button + year navigation + month pills', () => {
        render(<MonthlyAgendaModal open onClose={() => {}} client={client} />);
        // "Mês Atual" button (aria-label Ir para o mês atual)
        expect(
            screen.getByRole('button', { name: /ir para o mês atual/i }),
        ).toBeInTheDocument();
        // Year navigation buttons
        expect(
            screen.getByRole('button', { name: /ano anterior/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /próximo ano/i }),
        ).toBeInTheDocument();
        // Month pills — the current month pill should have aria-pressed=true
        const pressedPills = screen
            .getAllByRole('button')
            .filter(b => b.getAttribute('aria-pressed') === 'true');
        expect(pressedPills.length).toBeGreaterThanOrEqual(1);
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
        const todayBtn = screen.getByRole('button', {
            name: /ir para o mês atual/i,
        });
        fireEvent.click(todayBtn);
        // After click, the current month pill should have aria-pressed=true
        const now = new Date();
        const currentMonthAbbr = [
            'Jan',
            'Fev',
            'Mar',
            'Abr',
            'Mai',
            'Jun',
            'Jul',
            'Ago',
            'Set',
            'Out',
            'Nov',
            'Dez',
        ][now.getMonth()];
        const pressedPill = screen
            .getAllByRole('button')
            .find(
                b =>
                    b.getAttribute('aria-pressed') === 'true' &&
                    b.textContent === currentMonthAbbr,
            );
        expect(pressedPill).toBeTruthy();
    });
});
