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

// Stub ensureDeviceSession so it never consumes fetch mock slots
vi.mock('../services/sessions', () => ({
    default: () => Promise.resolve(),
    ensureDeviceSession: () => Promise.resolve(),
}));

// We'll mock findFirstPendingForClient per-test via vi.mocked()
const mockFindFirstPending = vi.fn();
vi.mock('../services/pending', () => ({
    findFirstPendingForClient: (...args: unknown[]) =>
        mockFindFirstPending(...args),
}));

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

    it('clicking Resolver agora fires pendingActions:open', async () => {
        const fetchMock = globalThis.fetch as unknown as Mock;
        const pendingEnd = new Date(Date.now() - 5 * 60_000).toISOString();
        const pendingStart = new Date(Date.now() - 30 * 60_000).toISOString();

        // usePendingGuard will call findFirstPendingForClient — mock to return pending
        mockFindFirstPending.mockResolvedValue({
            id: 555,
            status: 'scheduled',
            start_at: pendingStart,
            end_at: pendingEnd,
            client: client.id,
            title: 'Consulta',
            notes: undefined,
            client_name: client.first_name,
        });

        // "Resolver agora" fetch: GET /appointments/555/
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                id: 555,
                status: 'scheduled',
                start_at: pendingStart,
                end_at: pendingEnd,
                client: { id: client.id, name: client.first_name },
                title: 'Consulta',
                notes: null,
            }),
        } as unknown as Response);

        const listener = vi.fn<(e: Event) => void>();
        window.addEventListener('pendingActions:open', listener);
        openModal();

        // Pending guard detects the pending → "Resolver agora" button appears
        const resolverBtn = await screen.findByRole('button', {
            name: /resolver agora/i,
        });
        fireEvent.click(resolverBtn);

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
