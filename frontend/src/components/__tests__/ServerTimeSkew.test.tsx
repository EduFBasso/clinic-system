import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ServerTimeProvider } from '../../contexts/ServerTimeContext';
import AppointmentCard, {
    type SharedAppointmentLike,
} from '../shared/AppointmentCard';

// Utility to build an appointment starting "now" and ending +30m
function buildAppt(start: Date): SharedAppointmentLike {
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    return {
        id: 1,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        status: 'scheduled',
        title: 'Consulta',
        client_name: 'Cliente Teste',
    };
}

describe('ServerTimeProvider skew mitigation', () => {
    it('keeps appointment as scheduled when local clock is ahead by 2 minutes', () => {
        // Local machine time (fast): treat start_at as "now" local
        const localNow = new Date();
        const appt = buildAppt(localNow);
        // Simulate server being 2 minutes BEHIND local (offset = -120000)
        // Effective server time = localNow - 2m => before start => should remain scheduled
        render(
            <ServerTimeProvider fixedOffsetMs={-120000} disableFetch>
                <AppointmentCard appt={appt} />
            </ServerTimeProvider>,
        );
        // StatusBadge for scheduled currently renders with text mapping (assumed not 'Em andamento')
        // Defensive: ensure "Em andamento" NOT present
        const ongoing = screen.queryByText(/Em andamento/i);
        expect(ongoing).toBeNull();
    });
});
