import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ServerTimeProvider } from '../../contexts/ServerTimeContext';
import AppointmentCard, {
    type SharedAppointmentLike,
} from '../shared/AppointmentCard';

// Utility to build an appointment starting "now" and ending +30m
function buildAppt(start: Date, status: SharedAppointmentLike['status'] = 'scheduled'): SharedAppointmentLike {
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    return {
        id: 1,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        status,
        title: 'Consulta',
        client_name: 'Cliente Teste',
    };
}

describe('ServerTimeProvider (local-time only behavior)', () => {
    it('marks as ongoing when status is ongoing', () => {
        const localNow = new Date();
        const appt = buildAppt(localNow, 'ongoing');
        // ongoing status comes from server; AppointmentCard renders "Em andamento" badge
        render(
            <ServerTimeProvider fixedOffsetMs={-120000} disableFetch>
                <AppointmentCard appt={appt} />
            </ServerTimeProvider>,
        );
        const ongoing = screen.getByText(/Em andamento/i);
        expect(ongoing).toBeTruthy();
    });
});
