import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppointmentDetailsModal from '../AppointmentDetailsModal';
import type { SharedAppointmentLike } from '../shared/AppointmentCard';

vi.mock('../../utils/apiFetch', () => ({
    apiFetch: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>(
        'react-router-dom',
    );
    return {
        ...actual,
        useNavigate: () => vi.fn(),
    };
});

const { apiFetch } = await import('../../utils/apiFetch');

const appt: SharedAppointmentLike = {
    id: 44,
    title: 'Consulta',
    start_at: '2026-04-18T17:20:00.000Z',
    end_at: '2026-04-18T18:20:00.000Z',
    status: 'done',
    client_name: 'Elisa Figueiredo',
    client: 8,
};

describe('AppointmentDetailsModal mobile layout', () => {
    beforeEach(() => {
        vi.mocked(apiFetch).mockResolvedValue([
            {
                id: 1,
                title: 'Cobrança',
                status: 'open',
                items: [
                    {
                        id: 10,
                        item_type: 'service',
                        service: 3,
                        description: 'Onicocriptose',
                        quantity: '1',
                        unit_price: '180.00',
                        paid: false,
                    },
                ],
            },
        ] as unknown as Record<string, unknown>);
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            writable: true,
            value: 390,
        });
        window.dispatchEvent(new Event('resize'));
    });

    it('renders a stacked charge layout on narrow screens and keeps the close button available', async () => {
        render(
            <AppointmentDetailsModal
                open={true}
                onClose={() => {}}
                appt={appt}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Onicocriptose')).toBeInTheDocument();
        });

        expect(screen.getByLabelText('Fechar')).toBeInTheDocument();
        expect(
            screen.getAllByRole('button', { name: /fechar/i }).length,
        ).toBeGreaterThanOrEqual(2);

        expect(screen.getByText('Qtd')).toBeInTheDocument();
        expect(screen.getByText('Unit.')).toBeInTheDocument();
        expect(screen.getByText('Valor')).toBeInTheDocument();
        expect(screen.getAllByText('R$ 180,00').length).toBeGreaterThanOrEqual(
            3,
        );
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
});