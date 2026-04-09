import React from 'react';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DesktopAgendaPage from '../DesktopAgendaPage';
import {
    setAppointmentOverride,
    __clearOverridesForTests,
} from '../../utils/appointments/overrides';

// Mock the appointments hook to supply a canceled appointment whose real_closed_at
// is earlier than the originally scheduled end (so the early "Cancelado às" pill should appear)
vi.mock('../../hooks/useAppointments', () => {
    return {
        useAppointmentsRange: vi.fn(),
    };
});
import { useAppointmentsRange } from '../../hooks/useAppointments';

describe('DesktopAgendaPage early closed pill regression', () => {
    beforeEach(() => {
        __clearOverridesForTests();
        const now = Date.now();
        const start = new Date(now - 60 * 60 * 1000); // started 1h ago
        const originalEnd = new Date(now + 30 * 60 * 1000); // was planned to end in 30m
        const realClosed = new Date(now - 10 * 60 * 1000); // actually closed 10m ago => early

        (
            useAppointmentsRange as unknown as ReturnType<typeof vi.fn>
        ).mockReturnValue({
            items: [
                {
                    id: 7771,
                    start_at: start.toISOString(),
                    end_at: originalEnd.toISOString(),
                    status: 'canceled',
                    notes: '',
                    client_name: 'Cliente Cancelado Desktop',
                },
            ],
            loading: false,
            error: null,
        });

        setAppointmentOverride(7771, {
            status: 'canceled',
            original_end_at: originalEnd.toISOString(),
            real_closed_at: realClosed.toISOString(),
            real_closed_reason: 'canceled',
        });
    });

    it('shows "Cancelado às" pill for early canceled appointment after selecting canceled filter', async () => {
        render(
            <MemoryRouter>
                <DesktopAgendaPage />
            </MemoryRouter>,
        );
        // Change status filter to 'canceled' by clicking the pill button
        const canceladosBtn = await screen.findByRole('button', {
            name: 'Cancelados',
        });
        fireEvent.click(canceladosBtn);

        // The pill should render with localized label containing "Cancelado às"
        const pill = await screen.findByText(/Cancelado às/i);
        expect(pill).toBeInTheDocument();
        // Sanity: client name also present
        expect(
            screen.getByText(/Cliente Cancelado Desktop/i),
        ).toBeInTheDocument();
    });
});
