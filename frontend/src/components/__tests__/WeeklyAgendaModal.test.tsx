import React from 'react';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WeeklyAgendaModal from '../WeeklyAgendaModal';

// Fixed reference date for deterministic assertions (Wednesday)
const FIXED_NOW = new Date('2025-10-01T10:00:00');

describe('WeeklyAgendaModal', () => {
    // Silence known React testing warnings about act(...)
    let originalError: (...args: unknown[]) => void;
    beforeAll(() => {
        // Stabiliza Date.now sem congelar timers (evita travar efeitos assíncronos)
        vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW.getTime());
        originalError = console.error as unknown as (
            ...args: unknown[]
        ) => void;
        vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
            const msg = args[0];
            if (
                typeof msg === 'string' &&
                msg.includes('not wrapped in act(')
            ) {
                return;
            }
            originalError.apply(console, args as unknown[]);
        });
        // Provide minimal ResizeObserver stub for components using hook
        const g = globalThis as unknown as {
            ResizeObserver?: typeof ResizeObserver;
        };
        if (!g.ResizeObserver) {
            g.ResizeObserver = class {
                observe() {}
                unobserve() {}
                disconnect() {}
            } as unknown as typeof ResizeObserver;
        }
        // Stub IntersectionObserver to avoid auto-selection side effects in tests
        class IOStub {
            constructor(_cb: unknown, _opts?: unknown) {}
            observe() {}
            unobserve() {}
            disconnect() {}
        }
        vi.stubGlobal(
            'IntersectionObserver',
            IOStub as unknown as typeof IntersectionObserver,
        );
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });
    it('highlights today on open and shows today column selected', async () => {
        render(
            <WeeklyAgendaModal
                open={true}
                onClose={() => {}}
                initialDate={FIXED_NOW}
            />,
        );

        await waitFor(() => {
            const buttons = screen.getAllByRole('button');
            const dayButtons = buttons.filter(
                btn => btn.getAttribute('aria-pressed') !== null,
            );
            expect(dayButtons.length).toBeGreaterThan(0);
            const selected = dayButtons.find(
                btn => btn.getAttribute('aria-pressed') === 'true',
            );
            expect(selected).toBeTruthy();
            expect(selected?.textContent || '').toContain('01');
        });
    }, 12000);

    it('Hoje button shows aria-pressed=true after clicking it (when initialDate is same day it stays true)', async () => {
        const user = userEvent.setup();
        render(
            <WeeklyAgendaModal
                open={true}
                onClose={() => {}}
                initialDate={FIXED_NOW}
            />,
        );
        const hojeBtn = screen.getByRole('button', { name: /ir para hoje/i });
        // Clica em Hoje (ancora já está hoje) e verifica aria-pressed true
        await user.click(hojeBtn);
        await waitFor(() => {
            expect(hojeBtn.getAttribute('aria-pressed')).toBe('true');
        });
    }, 12000);
});
