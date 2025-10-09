import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import { setAppointmentOverride } from '../../utils/appointments/overrides';
import MonthlyAgendaModal from '../../components/MonthlyAgendaModal';
import type { ClientBasic } from '../../types/ClientBasic';

// Mock hook impl
vi.mock('../../hooks/useAppointments', () => {
    return {
        useAppointmentsRange: vi.fn(),
    };
});
import { useAppointmentsRange } from '../../hooks/useAppointments';

// Minimal shape aligning with ClientBasic for this test
interface MockClient {
    id: number;
    first_name: string;
    last_name: string;
    phone?: string;
    email?: string;
}

describe('MonthlyAgendaModal closed pill layout', () => {
    const baseClient: MockClient = {
        id: 1,
        first_name: 'Fulano',
        last_name: 'da Silva',
        phone: '',
        email: '',
    };

    beforeEach(() => {
        (
            useAppointmentsRange as unknown as ReturnType<typeof vi.fn>
        ).mockReturnValue({
            items: [
                {
                    id: 143,
                    start_at: new Date(
                        '2025-10-08T11:15:00.000Z',
                    ).toISOString(),
                    end_at: new Date('2025-10-08T12:15:00.000Z').toISOString(),
                    status: 'canceled',
                    notes: '',
                    client_name: 'Fulano da Silva',
                },
            ],
            loading: false,
        });
        // Simula fechamento antecipado (real_closed_at < end_at)
        setAppointmentOverride(143, {
            status: 'canceled',
            original_end_at: new Date('2025-10-08T12:15:00.000Z').toISOString(),
            real_closed_at: new Date('2025-10-08T11:19:00.000Z').toISOString(),
        } as { status: 'canceled'; original_end_at: string; real_closed_at: string });
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
    it('renders closed pill without truncating text excessively', () => {
        render(
            <MonthlyAgendaModal
                open
                client={baseClient as ClientBasic}
                onClose={() => {}}
            />,
        );
        const pill = screen.getByText(content =>
            /Cancelado às|Finalizado às/i.test(content),
        );
        expect(pill).toBeInTheDocument();
        const nameSpans = screen
            .getAllByTitle(/Fulano da Silva/i)
            .filter(el => el.tagName === 'SPAN');
        expect(nameSpans.length).toBeGreaterThan(0);
    });
});
