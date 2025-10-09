import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import AppointmentCard from '../AppointmentCard';
import {
    setAppointmentOverride,
    __clearOverridesForTests,
} from '../../../utils/appointments/overrides';

describe('AppointmentCard early finalize pill with original_end_at', () => {
    beforeEach(() => {
        __clearOverridesForTests();
    });

    it('shows "Finalizado às" pill when real_closed_at is before original end even after end_at shortening', () => {
        const start = new Date();
        start.setHours(start.getHours() - 1); // 1h ago
        const endPlanned = new Date(start.getTime() + 60 * 60 * 1000); // +1h
        const realClose = new Date(start.getTime() + 30 * 60 * 1000); // closed 30m after start (30m early)

        // Simula que o servidor encurtou end_at para realClose (ex: após PATCH).
        // Primeiro set override com end_at encurtado (sem original ainda)
        setAppointmentOverride(42, {
            status: 'done',
            end_at: realClose.toISOString(),
            real_closed_at: realClose.toISOString(),
            real_closed_reason: 'done',
            original_end_at: endPlanned.toISOString(),
        });

        render(
            <AppointmentCard
                appt={{
                    id: 42,
                    start_at: start.toISOString(),
                    end_at: endPlanned.toISOString(),
                    status: 'scheduled',
                    client_name: 'Paciente Teste',
                }}
            />,
        );

        const pill = screen.queryByText(/Finalizado às/i);
        expect(pill).toBeTruthy();
    });
});
