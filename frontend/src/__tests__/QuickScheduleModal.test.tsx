import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    afterEach,
    type Mock,
} from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import QuickScheduleModal from '../components/QuickScheduleModal';
import type { ClientBasic } from '../types/ClientBasic';

interface FetchResponse {
    ok: boolean;
    headers?: { get: (k: string) => string | null };
    json?: () => Promise<unknown>;
    text?: () => Promise<string>;
}

const client: ClientBasic = {
    id: 1,
    first_name: 'C',
    last_name: 'L',
    phone: '000',
    email: 'c@l',
};

function openModal() {
    return render(
        <QuickScheduleModal open={true} onClose={() => {}} client={client} />,
    );
}

beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(window.localStorage, 'getItem').mockReturnValue('token');
});

afterEach(() => {
    vi.resetAllMocks();
});

describe('QuickScheduleModal', () => {
    it('shows pending resolver behavior when backend blocks with pendente', async () => {
        const fetchMock = globalThis.fetch as unknown as Mock;
        const resp1: FetchResponse = {
            ok: false,
            headers: { get: () => 'text/plain' },
            text: async () => 'Cliente possui compromisso pendente',
        };
        const resp2: FetchResponse = {
            ok: true,
            json: async () => [
                {
                    id: 99,
                    status: 'scheduled',
                    end_at: new Date(Date.now() - 60_000).toISOString(),
                },
            ],
        };
        fetchMock.mockResolvedValueOnce(resp1 as unknown as Response);
        fetchMock.mockResolvedValueOnce(resp2 as unknown as Response);

        openModal();

        const createBtn = await screen.findByRole('button', { name: /criar/i });
        fireEvent.click(createBtn);

        await waitFor(() => {
            expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
        });
    });

    it('sends device headers on create', async () => {
        const fetchMock = globalThis.fetch as unknown as Mock;
        const resp: FetchResponse = {
            ok: true,
            json: async () => ({ id: 123 }),
        };
        fetchMock.mockResolvedValueOnce(resp as unknown as Response);

        openModal();

        const createBtn = await screen.findByRole('button', { name: /criar/i });
        fireEvent.click(createBtn);

        await waitFor(() => {
            const [url, init] = fetchMock.mock.calls[0];
            expect(String(url)).toMatch(/\/agenda\/appointments\/?$/);
            const headers = (init as RequestInit)?.headers as Record<
                string,
                string
            >;
            expect(headers).toBeTruthy();
            expect(headers['x-device-id']).toBeTruthy();
            expect(headers['x-device-info']).toBeTruthy();
        });
    });

    it('time dropdown interaction does not affect visit type select', async () => {
        (globalThis.fetch as unknown as Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => [],
        } as unknown as Response);
        openModal();
        // Find the visit type select by label 'Tipo'
        const tipo = await screen.findByLabelText(/tipo/i);
        // Assert initial value 'Consulta'
        expect((tipo as HTMLSelectElement).value).toBe('consulta');
        // Interact with the TimePicker hour select (label 'Início')
        const hourSelect = await screen.findByLabelText(/início/i, {
            selector: 'label select',
        });
        fireEvent.mouseDown(hourSelect);
        fireEvent.click(hourSelect);
        fireEvent.keyDown(hourSelect, { key: 'ArrowDown' });
        // The visit type should remain unchanged
        expect((tipo as HTMLSelectElement).value).toBe('consulta');
    });
});
