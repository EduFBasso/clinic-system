import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

vi.mock('@simplewebauthn/browser', () => ({
    startRegistration: vi.fn(),
    startAuthentication: vi.fn(),
}));

describe('NavBar login code flow', () => {
    function renderNavBar() {
        return render(
            <MemoryRouter>
                <NavBar />
            </MemoryRouter>,
        );
    }

    beforeEach(() => {
        vi.restoreAllMocks();
        const store: Record<string, string> = {};
        class MockPublicKeyCredential {}
        (
            MockPublicKeyCredential as typeof PublicKeyCredential & {
                isUserVerifyingPlatformAuthenticatorAvailable: () => Promise<boolean>;
            }
        ).isUserVerifyingPlatformAuthenticatorAvailable = vi
            .fn()
            .mockResolvedValue(true);
        vi.stubGlobal('PublicKeyCredential', MockPublicKeyCredential);
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

    it('exibe o botao Face ID quando o email esta preenchido mesmo sem marcador local', async () => {
        renderNavBar();

        fireEvent.change(screen.getByPlaceholderText('E-mail'), {
            target: { value: 'brunadentista@mail.com' },
        });

        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: /Face ID/i }),
            ).toBeInTheDocument();
        });
    });

    it('preenche email e código TOTP e autentica', async () => {
        const professionalEmail = 'pro1@example.com';

        vi.spyOn(globalThis, 'fetch').mockImplementation(
            (input: RequestInfo | URL, init?: RequestInit) => {
                const url =
                    typeof input === 'string'
                        ? input
                        : input instanceof URL
                          ? input.toString()
                          : (input as Request).url;

                if (/totp\/verify\//.test(url) && init?.method === 'POST') {
                    return Promise.resolve(
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
                    );
                }

                return Promise.resolve(
                    new Response('not mocked', { status: 404 }),
                );
            },
        );

        renderNavBar();

        // Preenche email
        const emailInput = screen.getByPlaceholderText('E-mail');
        fireEvent.change(emailInput, { target: { value: professionalEmail } });

        // Preenche código TOTP (6 dígitos)
        const codeInput = screen.getByPlaceholderText('Código (6 dígitos)');
        fireEvent.change(codeInput, { target: { value: '123456' } });

        // Botão Entrar deve estar habilitado
        const enterBtn = screen.getByRole('button', { name: /Entrar/i });
        expect(enterBtn).not.toBeDisabled();
        fireEvent.click(enterBtn);

        // Token salvo no localStorage após login bem-sucedido
        await waitFor(
            () => {
                expect(localStorage.getItem('accessToken')).toBe('tokenX');
            },
            { timeout: 8000 },
        );

        // Botão Sair deve aparecer
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
