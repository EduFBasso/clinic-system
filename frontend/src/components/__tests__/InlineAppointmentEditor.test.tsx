import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InlineAppointmentEditor from '../InlineAppointmentEditor';
import type { Appointment } from '../../hooks/useAppointments';

function makeAppt(partial: Partial<Appointment> = {}): Appointment {
    // Use a deterministic same-day window (avoids midnight-crossing validation issues)
    const base = new Date();
    // Force to 09:00 local time today
    base.setHours(9, 0, 0, 0);
    const start = new Date(base.getTime() + 60 * 60 * 1000); // 10:00
    const end = new Date(base.getTime() + 2 * 60 * 60 * 1000); // 11:00
    return {
        id: 1,
        professional: 1,
        client: 1,
        title: 'Consulta',
        visit_type: 'consulta',
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        status: 'scheduled',
        ...partial,
    } as Appointment;
}

describe('InlineAppointmentEditor', () => {
    const originalFetch = global.fetch;
    beforeEach(() => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => makeAppt({ id: 1 }),
        } as unknown as Response);
        localStorage.setItem('accessToken', 'token');
    });
    afterEach(() => {
        global.fetch = originalFetch as typeof global.fetch;
        localStorage.clear();
    });

    it('renders and saves', async () => {
        const appt = makeAppt();
        const onSaved = vi.fn();
        render(
            <InlineAppointmentEditor
                appt={appt}
                onCancel={() => {}}
                onSaved={onSaved}
            />,
        );
        // Change end time minute to force PATCH
        const saveBtn = screen.getByRole('button', { name: /Salvar/i });
        fireEvent.click(saveBtn);
        await waitFor(() => expect(onSaved).toHaveBeenCalled(), {
            timeout: 500,
        });
    });
});
