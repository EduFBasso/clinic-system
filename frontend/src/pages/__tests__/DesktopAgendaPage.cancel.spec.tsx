import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DesktopAgendaPage from '../DesktopAgendaPage';
import type { Appointment } from '../../hooks/useAppointments';

vi.mock('../../hooks/useAppointments', () => ({
    useAppointmentsRange: vi.fn(),
}));

vi.mock('../../services/appointments', () => ({
    cancelAppointment: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
}));

import { useAppointmentsRange } from '../../hooks/useAppointments';
import { cancelAppointment } from '../../services/appointments';

function makeScheduledAppt(): Appointment {
    return {
        id: 301,
        professional: 3,
        client: { id: 9, name: 'Cliente Desktop' } as unknown as number,
        client_name: 'Cliente Desktop',
        title: 'Consulta',
        visit_type: 'consulta',
        start_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        end_at: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
        status: 'scheduled',
        notes: '',
    };
}

describe('DesktopAgendaPage active card cancel', () => {
    beforeEach(() => {
        localStorage.setItem('accessToken', 'test-token');
        vi.mocked(useAppointmentsRange).mockReturnValue({
            items: [makeScheduledAppt()],
            loading: false,
            error: null,
        });
        vi.mocked(cancelAppointment).mockClear();
    });

    it('cancels an active appointment when the desktop card is tapped', async () => {
        render(
            <MemoryRouter>
                <DesktopAgendaPage />
            </MemoryRouter>,
        );

        fireEvent.click(await screen.findByText('Cliente Desktop'));
        fireEvent.click(
            await screen.findByRole('button', {
                name: 'Cancelar compromisso',
            }),
        );

        await waitFor(() => {
            expect(cancelAppointment).toHaveBeenCalledTimes(1);
            expect(cancelAppointment).toHaveBeenCalledWith(301);
        });
    });
});