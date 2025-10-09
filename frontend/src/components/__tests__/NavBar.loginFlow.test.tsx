import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NavBar from '../../components/NavBar';
// Mock clock hook to avoid alignment timers & network drift during test
vi.mock('../../hooks/useUtcClock', () => ({
    useUtcClock: () => ({
        nowLocal: new Date('2025-10-06T10:00:00Z'),
        nowCorrectedUTC: new Date('2025-10-06T10:00:00Z'),
        hhmmUTC: '10:00',
        driftMsApplied: 0,
    }),
}));

// Helper to sequence mocked fetch responses
interface MockStep {
    matcher: (url: string, init?: RequestInit) => boolean;
    response: () => Promise<Response> | Response;
}

function createSequencedFetch(steps: MockStep[]) {
    return vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
            const url =
                typeof input === 'string'
                    ? input
                    : input instanceof URL
                    ? input.toString()
                    : input.url;
            const step = steps.find(s => s.matcher(url, init));
            if (!step) {
                // Default 404
                return Promise.resolve(
                    new Response('not mocked', { status: 404 }),
                );
            }
            try {
                const r = step.response();
                return r instanceof Promise ? r : Promise.resolve(r);
            } catch (e) {
                return Promise.resolve(
                    new Response(String(e), { status: 500 }),
                );
            }
        });
}

describe('NavBar login code flow', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        // Reset localStorage mock
        const store: Record<string, string> = {};
        // @ts-expect-error test shim
        global.localStorage = {
            getItem: (k: string) => (k in store ? store[k] : null),
            setItem: (k: string, v: string) => {
                store[k] = v;
            },
            removeItem: (k: string) => {
                delete store[k];
            },
            clear: () => {
                Object.keys(store).forEach(k => delete store[k]);
            },
        };
    });

    it('envia código, fecha modal com Enter, mostra campo senha e autentica', async () => {
        const professionalEmail = 'pro1@example.com';
        const steps: MockStep[] = [
            // Professionals list
            {
                matcher: url => /register\/professionals-basic\//.test(url),
                response: () =>
                    new Response(
                        JSON.stringify([
                            {
                                id: 1,
                                first_name: 'Ana',
                                last_name: 'Silva',
                                register_number: '123',
                                email: professionalEmail,
                            },
                        ]),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    ),
            },
            // request-code
            {
                matcher: (url, init) =>
                    /register\/auth\/request-code\//.test(url) &&
                    init?.method === 'POST',
                response: () =>
                    new Response(
                        JSON.stringify({ message: 'Código enviado' }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    ),
            },
            // verify-code
            {
                matcher: (url, init) =>
                    /register\/auth\/verify-code\//.test(url) &&
                    init?.method === 'POST',
                response: () =>
                    new Response(
                        JSON.stringify({
                            access: 'tokenX',
                            professional: {
                                id: 1,
                                first_name: 'Ana',
                                last_name: 'Silva',
                                register_number: '123',
                                email: professionalEmail,
                            },
                            active_sessions_count: 1,
                            device_id: 'dev-123',
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    ),
            },
        ];

        createSequencedFetch(steps);

        render(<NavBar />);

        const profButton = await screen.findByRole('button', {
            name: /Profissionais/i,
        });
        fireEvent.click(profButton);

        // Seleciona profissional
        const option = await screen.findByRole('button', { name: /Ana Silva/ });
        fireEvent.click(option);

        // Botão Enviar código aparece
        const sendCodeBtn = await screen.findByRole('button', {
            name: /Enviar código/i,
        });
        fireEvent.click(sendCodeBtn);

        // Modal com mensagem deve aparecer
        const modalHeading = await screen.findByRole('heading', {
            name: /Código enviado/i,
        });
        expect(modalHeading).toBeInTheDocument();

        // Pressiona Enter para fechar (hotkey)
        fireEvent.keyDown(document, { key: 'Enter', code: 'Enter' });

        // Modal desmonta (heading some) e campo de senha deve aparecer
        await waitFor(() => {
            expect(
                screen.queryByRole('heading', { name: /Código enviado/i }),
            ).toBeNull();
        });

        const passwordInput = await screen.findByPlaceholderText('Senha');
        fireEvent.change(passwordInput, { target: { value: '123456' } });

        const enterBtn = screen.getByRole('button', { name: /Entrar/i });
        fireEvent.click(enterBtn);

        // Após login, deve aparecer botão Sair e token salvo
        // Se por algum efeito colateral o modal de Configurações estiver aberto, fechar antes de assert
        const maybeSettings = screen.queryByRole('heading', {
            name: /Configurações da Agenda/i,
        });
        if (maybeSettings) {
            // Tenta clicar no botão de fechar (aria-label='Fechar')
            const closeBtn = screen.queryByRole('button', { name: /Fechar/i });
            if (closeBtn) fireEvent.click(closeBtn);
        }

        await waitFor(
            () => {
                expect(localStorage.getItem('accessToken')).toBe('tokenX');
            },
            { timeout: 8000 },
        );
        // Agora valida presença do botão Sair
        await waitFor(
            () => {
                const logoutBtn = screen.getByRole('button', {
                    name: /Sair/i,
                    hidden: true,
                });
                expect(logoutBtn).toBeInTheDocument();
            },
            { timeout: 4000 },
        );
    }, 20000);
});
