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

        await waitFor(
            () => {
                expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
            },
            { timeout: 10000 },
        );
    }, 15000);

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

    it('clicking a pending minicard fires pendingActions:open', async () => {
        const fetchMock = globalThis.fetch as unknown as Mock;
        // First call: create attempt blocked (simula texto pendente)
        fetchMock.mockResolvedValueOnce({
            ok: false,
            headers: { get: () => 'text/plain' },
            text: async () => 'Cliente possui compromisso pendente',
        } as unknown as Response);
        // Second call: list pending appointments
        const pendingEnd = new Date(Date.now() - 5 * 60_000).toISOString();
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => [
                {
                    id: 555,
                    status: 'scheduled',
                    start_at: new Date(Date.now() - 30 * 60_000).toISOString(),
                    end_at: pendingEnd,
                    client: { id: client.id, name: client.first_name },
                },
            ],
        } as unknown as Response);

        const listener = vi.fn<(e: Event) => void>();
        window.addEventListener('pendingActions:open', listener);
        openModal();

        const createBtn = await screen.findByRole('button', { name: /criar/i });
        fireEvent.click(createBtn);

        await waitFor(() =>
            expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2),
        );

        // The pending card should now be rendered; select by status badge text 'Pendente' (ou 'Past'?)
        // Procurar um botão/div com role=button e texto do nome do cliente
        const card = await screen.findByText(/c l/i); // nome abreviado no card (C L)
        fireEvent.click(card);

        await waitFor(() => expect(listener).toHaveBeenCalled());
        interface PendingDetail {
            appt?: { id?: number };
        }
        const evt = listener.mock.calls[0][0] as CustomEvent<PendingDetail>;
        expect(evt).toBeTruthy();
        expect(evt.detail?.appt?.id).toBe(555);
        window.removeEventListener('pendingActions:open', listener);
    });
});
