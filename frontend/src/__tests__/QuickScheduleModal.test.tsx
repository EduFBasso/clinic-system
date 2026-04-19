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
import type { Appointment } from '../hooks/useAppointments';

vi.mock('../hooks/useAppointments', () => ({
    useAppointmentsRange: vi.fn(),
}));

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

const elisaClient: ClientBasic = {
    id: 2,
    first_name: 'Elisa',
    last_name: 'Figueiredo',
    phone: '111',
    email: 'elisa@mail.com',
};

const { useAppointmentsRange } = await import('../hooks/useAppointments');

function makeScheduledAppt(): Appointment {
    const start = new Date(Date.now() + 3 * 60 * 60 * 1000);
    start.setMinutes(0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return {
        id: 77,
        professional: 2,
        client: { id: 1, name: 'C L' } as unknown as number,
        client_name: 'C L',
        title: 'Consulta',
        visit_type: 'consulta',
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        status: 'scheduled',
        notes: 'ajustar horario',
    };
}

function openModal() {
    return render(
        <QuickScheduleModal open={true} onClose={() => {}} client={client} />,
    );
}

beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    vi.spyOn(window.localStorage, 'getItem').mockReturnValue('token');
    vi.mocked(useAppointmentsRange).mockReturnValue({
        items: [],
        loading: false,
        error: null,
    });
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

    it('loads the selected appointment into the form when editing from the day card', async () => {
        const appt = makeScheduledAppt();
        vi.mocked(useAppointmentsRange).mockReturnValue({
            items: [appt],
            loading: false,
            error: null,
        });

        openModal();

        fireEvent.click(await screen.findByText('C L'));
        fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: 'Salvar' }),
            ).toBeInTheDocument();
        });

        const startDate = new Date(appt.start_at);
        const endDate = new Date(appt.end_at);
        const comboboxes = screen.getAllByRole('combobox');
        expect((comboboxes[0] as HTMLSelectElement).value).toBe(
            String(startDate.getHours()).padStart(2, '0'),
        );
        expect((comboboxes[1] as HTMLSelectElement).value).toBe(
            String(startDate.getMinutes()).padStart(2, '0'),
        );
        expect((comboboxes[2] as HTMLSelectElement).value).toBe(
            String(endDate.getHours()).padStart(2, '0'),
        );
        expect((comboboxes[3] as HTMLSelectElement).value).toBe(
            String(endDate.getMinutes()).padStart(2, '0'),
        );
        expect((comboboxes[4] as HTMLSelectElement).value).toBe('consulta');
        expect(screen.getByRole('textbox')).toHaveValue('ajustar horario');
    });

    it('restores the preserved draft when reopening the scheduler after another flow', async () => {
        render(
            <QuickScheduleModal
                open={true}
                onClose={() => {}}
                client={client}
                initialDraft={{
                    clientId: client.id,
                    selectedDateISO: '2026-04-19T00:00:00.000Z',
                    startHM: '11:00',
                    endHM: '11:30',
                    visitType: 'consulta',
                    notes: 'retomar rascunho',
                }}
            />,
        );

        const comboboxes = await screen.findAllByRole('combobox');
        expect((comboboxes[0] as HTMLSelectElement).value).toBe('11');
        expect((comboboxes[1] as HTMLSelectElement).value).toBe('00');
        expect((comboboxes[2] as HTMLSelectElement).value).toBe('11');
        expect((comboboxes[3] as HTMLSelectElement).value).toBe('30');
        expect((comboboxes[4] as HTMLSelectElement).value).toBe('consulta');
        expect(screen.getByRole('textbox')).toHaveValue('retomar rascunho');
    });

    it('clears a stale conflict message after switching from create to edit mode', async () => {
        const appt = makeScheduledAppt();
        vi.mocked(useAppointmentsRange).mockReturnValue({
            items: [appt],
            loading: false,
            error: null,
        });

        const listener = vi.fn<(e: Event) => void>();
        window.addEventListener('systemMessage', listener);

        (globalThis.fetch as unknown as Mock).mockResolvedValueOnce({
            ok: false,
            headers: { get: () => 'application/json' },
            json: async () => ({
                non_field_errors: [
                    'Conflito de horário com outro compromisso.',
                ],
            }),
        } as unknown as Response);

        openModal();

        fireEvent.click(await screen.findByRole('button', { name: /criar/i }));

        await waitFor(() => {
            expect(listener).toHaveBeenCalled();
        });

        const event = listener.mock.calls.at(-1)?.[0] as CustomEvent<{
            text?: string;
            type?: string;
        }>;
        expect(event.detail?.type).toBe('error');
        expect(event.detail?.text).toMatch(/existe um compromisso neste período/i);

        fireEvent.click(screen.getByText('C L'));
        fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: 'Salvar' }),
            ).toBeInTheDocument();
        });

        expect(
            screen.queryByText(/conflito de horário:/i),
        ).not.toBeInTheDocument();
        window.removeEventListener('systemMessage', listener);
    });

    it('shows the conflict state in the header and keeps only the conflicting card visible', async () => {
        const appt = makeScheduledAppt();
        const otherAppt: Appointment = {
            ...appt,
            id: 78,
            client: { id: 2, name: 'Outro Cliente' } as unknown as number,
            client_name: 'Outro Cliente',
            start_at: new Date(
                new Date(appt.end_at).getTime() + 60 * 60 * 1000,
            ).toISOString(),
            end_at: new Date(
                new Date(appt.end_at).getTime() + 90 * 60 * 1000,
            ).toISOString(),
        };
        vi.mocked(useAppointmentsRange).mockReturnValue({
            items: [appt, otherAppt],
            loading: false,
            error: null,
        });

        const listener = vi.fn<(e: Event) => void>();
        window.addEventListener('systemMessage', listener);

        (globalThis.fetch as unknown as Mock).mockResolvedValueOnce({
            ok: false,
            headers: { get: () => 'application/json' },
            json: async () => ({
                non_field_errors: [
                    'Conflito de horário com outro compromisso.',
                ],
            }),
        } as unknown as Response);

        openModal();

        fireEvent.click(await screen.findByRole('button', { name: /criar/i }));
        await waitFor(() => expect(listener).toHaveBeenCalled());

        fireEvent.click(await screen.findByText('C L'));
        fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

        await waitFor(() => {
            expect(
                screen.getByText(
                    /Este compromisso esta ocupando o horario que C quer agendar/i,
                ),
            ).toBeInTheDocument();
        });

        const card = document.getElementById('appt-card-77');
        expect(card?.getAttribute('data-selected')).toBe('true');
        expect(card?.getAttribute('data-editing-active')).toBe('true');
        expect(screen.queryByText('Outro Cliente')).not.toBeInTheDocument();
        window.removeEventListener('systemMessage', listener);
    });

    it('highlights and scrolls the conflicting card after create conflict', async () => {
        const appt = makeScheduledAppt();
        const apptStart = new Date(appt.start_at);
        const apptEnd = new Date(appt.end_at);
        vi.mocked(useAppointmentsRange).mockReturnValue({
            items: [appt],
            loading: false,
            error: null,
        });

        const listener = vi.fn<(e: Event) => void>();
        window.addEventListener('systemMessage', listener);

        (globalThis.fetch as unknown as Mock).mockResolvedValueOnce({
            ok: false,
            headers: { get: () => 'application/json' },
            json: async () => ({
                non_field_errors: [
                    'Conflito de horário com outro compromisso.',
                ],
            }),
        } as unknown as Response);

        openModal();

        const comboboxes = screen.getAllByRole('combobox');
        fireEvent.change(comboboxes[0], {
            target: {
                value: String(apptStart.getHours()).padStart(2, '0'),
            },
        });
        fireEvent.change(comboboxes[1], {
            target: {
                value: String(apptStart.getMinutes()).padStart(2, '0'),
            },
        });
        fireEvent.change(comboboxes[2], {
            target: {
                value: String(apptEnd.getHours()).padStart(2, '0'),
            },
        });
        fireEvent.change(comboboxes[3], {
            target: {
                value: String(apptEnd.getMinutes()).padStart(2, '0'),
            },
        });

        fireEvent.click(screen.getByRole('button', { name: /criar/i }));

        await waitFor(() => expect(listener).toHaveBeenCalled());
        await waitFor(() => {
            const card = document.getElementById('appt-card-77');
            expect(card?.getAttribute('data-highlighted')).toBe('true');
        });
        const event = listener.mock.calls.at(-1)?.[0] as CustomEvent<{
            text?: string;
        }>;
        expect(event.detail?.text).toMatch(/toque no cartão destacado/i);
        window.removeEventListener('systemMessage', listener);
    });

    it('switches the header to the conflicting client while editing the blocking appointment', async () => {
        const conflictingApptBase = makeScheduledAppt();
        const conflictingAppt: Appointment = {
            ...conflictingApptBase,
            client: {
                id: 9,
                name: 'Eduardo Figueiredo Basso',
            } as unknown as number,
            client_name: 'Eduardo Figueiredo Basso',
        };
        vi.mocked(useAppointmentsRange).mockReturnValue({
            items: [conflictingAppt],
            loading: false,
            error: null,
        });

        const listener = vi.fn<(e: Event) => void>();
        window.addEventListener('systemMessage', listener);

        (globalThis.fetch as unknown as Mock).mockResolvedValueOnce({
            ok: false,
            headers: { get: () => 'application/json' },
            json: async () => ({
                non_field_errors: [
                    'Conflito de horário com outro compromisso.',
                ],
            }),
        } as unknown as Response);

        render(
            <QuickScheduleModal
                open={true}
                onClose={() => {}}
                client={elisaClient}
            />,
        );

        const comboboxes = screen.getAllByRole('combobox');
        const conflictingStart = new Date(conflictingAppt.start_at);
        const conflictingEnd = new Date(conflictingAppt.end_at);
        fireEvent.change(comboboxes[0], {
            target: {
                value: String(conflictingStart.getHours()).padStart(2, '0'),
            },
        });
        fireEvent.change(comboboxes[1], {
            target: {
                value: String(conflictingStart.getMinutes()).padStart(2, '0'),
            },
        });
        fireEvent.change(comboboxes[2], {
            target: {
                value: String(conflictingEnd.getHours()).padStart(2, '0'),
            },
        });
        fireEvent.change(comboboxes[3], {
            target: {
                value: String(conflictingEnd.getMinutes()).padStart(2, '0'),
            },
        });

        fireEvent.click(screen.getByRole('button', { name: /criar/i }));
        await waitFor(() => expect(listener).toHaveBeenCalled());

        const event = listener.mock.calls.at(-1)?.[0] as CustomEvent<{
            text?: string;
        }>;
        expect(event.detail?.text).toMatch(/remover o conflito/i);

        const card = document.getElementById('appt-card-77');
        expect(card).toBeTruthy();
        fireEvent.click(card as HTMLElement);
        fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

        await waitFor(() => {
            expect(
                screen.getByText((_content, node) => {
                    return node?.tagName === 'H2' &&
                        node.textContent?.replace(/\s+/g, ' ').trim() ===
                            'Eduardo Figueiredo Basso';
                }),
            ).toBeInTheDocument();
        });

        expect(screen.queryByRole('heading', { level: 2, name: 'Elisa' })).not.toBeInTheDocument();
        expect(
            screen.getByText(
                /Este compromisso esta ocupando o horario que Elisa quer agendar/i,
            ),
        ).toBeInTheDocument();
        window.removeEventListener('systemMessage', listener);
    });

    it('returns to the original client draft after saving the conflicting appointment edit', async () => {
        const conflictingStart = new Date(Date.now() + 3 * 60 * 60 * 1000);
        conflictingStart.setMinutes(30, 0, 0);
        const conflictingEnd = new Date(
            conflictingStart.getTime() + 30 * 60 * 1000,
        );
        const originalDraftStart = new Date(
            conflictingStart.getTime() + 25 * 60 * 1000,
        );
        const originalDraftEnd = new Date(
            originalDraftStart.getTime() + 30 * 60 * 1000,
        );
        const conflictingAppt = {
            ...makeScheduledAppt(),
            client: {
                id: 11,
                name: 'Elisa Figueiredo',
            } as unknown as number,
            client_name: 'Elisa Figueiredo',
            visit_type: 'retorno' as Appointment['visit_type'],
            start_at: conflictingStart.toISOString(),
            end_at: conflictingEnd.toISOString(),
        };
        vi.mocked(useAppointmentsRange).mockReturnValue({
            items: [conflictingAppt],
            loading: false,
            error: null,
        });

        const listener = vi.fn<(e: Event) => void>();
        window.addEventListener('systemMessage', listener);

        (globalThis.fetch as unknown as Mock)
            .mockResolvedValueOnce({
                ok: false,
                headers: { get: () => 'application/json' },
                json: async () => ({
                    non_field_errors: [
                        'Conflito de horário com outro compromisso.',
                    ],
                }),
            } as unknown as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: conflictingAppt.id }),
            } as unknown as Response);

        render(
            <QuickScheduleModal
                open={true}
                onClose={() => {}}
                client={client}
            />,
        );

        const comboboxes = screen.getAllByRole('combobox');
        fireEvent.change(comboboxes[0], {
            target: {
                value: String(originalDraftStart.getHours()).padStart(2, '0'),
            },
        });
        fireEvent.change(comboboxes[1], {
            target: {
                value: String(originalDraftStart.getMinutes()).padStart(2, '0'),
            },
        });
        fireEvent.change(comboboxes[2], {
            target: {
                value: String(originalDraftEnd.getHours()).padStart(2, '0'),
            },
        });
        fireEvent.change(comboboxes[3], {
            target: {
                value: String(originalDraftEnd.getMinutes()).padStart(2, '0'),
            },
        });
        fireEvent.change(comboboxes[4], {
            target: { value: 'consulta' },
        });
        fireEvent.change(screen.getByRole('textbox'), {
            target: { value: 'agendamento da cliente original' },
        });

        fireEvent.click(screen.getByRole('button', { name: /criar/i }));
        await waitFor(() => expect(listener).toHaveBeenCalled());

        const card = document.getElementById(`appt-card-${conflictingAppt.id}`);
        expect(card).toBeTruthy();
        fireEvent.click(card as HTMLElement);
        fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

        await waitFor(() => {
            expect(
                screen.getByText((_content, node) => {
                    return node?.tagName === 'H2' &&
                        node.textContent?.replace(/\s+/g, ' ').trim() ===
                            'Elisa Figueiredo';
                }),
            ).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

        await waitFor(() => {
            expect(
                screen.getByText((_content, node) => {
                    return node?.tagName === 'H2' &&
                        node.textContent?.replace(/\s+/g, ' ').trim() === 'C L';
                }),
            ).toBeInTheDocument();
        });

        expect(
            screen.getByRole('button', { name: 'Criar' }),
        ).toBeInTheDocument();
        expect(screen.getByRole('textbox')).toHaveValue(
            'agendamento da cliente original',
        );
        expect(
            screen.queryByText(
                /Este compromisso esta ocupando o horario que C quer agendar/i,
            ),
        ).not.toBeInTheDocument();
        window.removeEventListener('systemMessage', listener);
    });
});
