import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MonthlyAgendaModal } from '../../components/MonthlyAgendaModal/MonthlyAgendaModal';
import type { ClientBasic } from '../../types/ClientBasic';
import type { Appointment } from '../../hooks/useAppointments';

vi.mock('../../hooks/useAppointments', () => ({
    useAppointmentsRange: vi
        .fn()
        .mockReturnValue({ items: [], loading: false, error: null }),
}));

vi.mock('../../services/appointments', () => ({
    cancelAppointment: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
}));

const client: ClientBasic = {
    id: 1,
    first_name: 'Maria',
    last_name: 'Oliveira',
    phone: '',
    email: '',
};

const useAppointmentsRangeMock = vi.mocked(
    await import('../../hooks/useAppointments').then(m => m.useAppointmentsRange),
);
const cancelAppointmentMock = vi.mocked(
    await import('../../services/appointments').then(m => m.cancelAppointment),
);

function makeScheduledAppt(): Appointment {
    return {
        id: 11,
        professional: 2,
        client: 1,
        client_name: 'Maria Oliveira',
        title: 'Consulta',
        visit_type: 'consulta',
        start_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        end_at: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
        status: 'scheduled',
        notes: '',
    };
}

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
        useAppointmentsRangeMock.mockReturnValue({
            items: [],
            loading: false,
            error: null,
        });
        cancelAppointmentMock.mockClear();
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

    it('opens the active appointment chooser before cancellation', async () => {
        useAppointmentsRangeMock.mockReturnValue({
            items: [makeScheduledAppt()],
            loading: false,
            error: null,
        });

        render(<MonthlyAgendaModal open onClose={() => {}} client={client} />);

        fireEvent.click(screen.getByText('Maria Oliveira'));
        expect(
            await screen.findByText('Compromisso ativo'),
        ).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole('button', { name: 'Cancelar compromisso' }),
        );

        await waitFor(() => {
            expect(cancelAppointmentMock).toHaveBeenCalledTimes(1);
            expect(cancelAppointmentMock).toHaveBeenCalledWith(11);
        });
    });
});
