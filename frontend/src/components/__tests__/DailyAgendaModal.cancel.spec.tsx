import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DailyAgendaModal from '../DailyAgendaModal';
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
        id: 91,
        professional: 2,
        client: { id: 7, name: 'Cliente Diario' } as unknown as number,
        client_name: 'Cliente Diario',
        title: 'Consulta',
        visit_type: 'consulta',
        start_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        end_at: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
        status: 'scheduled',
        notes: '',
    };
}

describe('DailyAgendaModal active card cancel', () => {
    beforeEach(() => {
        vi.mocked(useAppointmentsRange).mockReturnValue({
            items: [makeScheduledAppt()],
            loading: false,
            error: null,
        });
        vi.mocked(cancelAppointment).mockClear();
    });

    it('cancels an active appointment when the card is tapped', async () => {
        render(
            <DailyAgendaModal
                open={true}
                date={new Date('2026-04-18T12:00:00')}
                onClose={() => {}}
            />,
        );

        fireEvent.click(screen.getByText('Cliente Diario'));
        fireEvent.click(
            await screen.findByRole('button', {
                name: 'Cancelar compromisso',
            }),
        );

        await waitFor(() => {
            expect(cancelAppointment).toHaveBeenCalledTimes(1);
            expect(cancelAppointment).toHaveBeenCalledWith(91);
        });
    });
});