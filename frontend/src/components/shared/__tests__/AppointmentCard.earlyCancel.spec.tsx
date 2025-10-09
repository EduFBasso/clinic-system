import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import AppointmentCard from '../AppointmentCard';
import {
    setAppointmentOverride,
    __clearOverridesForTests,
} from '../../../utils/appointments/overrides';

function isoOffset(minutesFromNow: number) {
    return new Date(Date.now() + minutesFromNow * 60000).toISOString();
}

describe('AppointmentCard early cancel pill', () => {
    beforeEach(() => {
        __clearOverridesForTests();
    });

    it('shows "Cancelado às" when canceled early (real_closed_at before original end)', () => {
        const start = isoOffset(-60); // 1h atrás
        const endOriginal = isoOffset(0); // agora seria o fim planejado
        const cancelAt = isoOffset(-30); // cancelado há 30 min (30 min antes do fim)

        setAppointmentOverride(99, {
            status: 'canceled',
            real_closed_at: cancelAt,
            real_closed_reason: 'canceled',
            original_end_at: endOriginal,
        });

        render(
            <AppointmentCard
                appt={{
                    id: 99,
                    start_at: start,
                    // end_at prop ainda carrega original para simular estado inicial
                    end_at: endOriginal,
                    status: 'scheduled',
                    client_name: 'Paciente Cancelado',
                }}
            />,
        );

        const pill = screen.queryByText(/Cancelado às/i);
        expect(pill).toBeTruthy();
    });

    it('does not show pill if canceled at (or after) planned end (margin respected)', () => {
        const start = isoOffset(-60);
        const endOriginal = isoOffset(-1); // já teria acabado há 1 min
        const cancelAt = isoOffset(-1); // cancel no final

        setAppointmentOverride(100, {
            status: 'canceled',
            real_closed_at: cancelAt,
            real_closed_reason: 'canceled',
            original_end_at: endOriginal,
        });

        render(
            <AppointmentCard
                appt={{
                    id: 100,
                    start_at: start,
                    end_at: endOriginal,
                    status: 'scheduled',
                    client_name: 'Paciente Cancelado 2',
                }}
            />,
        );

        const pill = screen.queryByText(/Cancelado às/i);
        expect(pill).toBeFalsy();
    });
});
