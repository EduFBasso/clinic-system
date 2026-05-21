import React from 'react';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppModal } from '../Modal/Modal';

// Utility wrapper to control open prop
function ModalHarness({ initiallyOpen = true }: { initiallyOpen?: boolean }) {
    const [open, setOpen] = React.useState(initiallyOpen);
    return (
        <>
            <button onClick={() => setOpen(true)}>open</button>
            <AppModal open={open} onClose={() => setOpen(false)}>
                <div>
                    <h2>Conteúdo Modal</h2>
                    <button onClick={() => setOpen(false)}>fechar</button>
                </div>
            </AppModal>
        </>
    );
}

function NamedModalHarness({
    openerLabel,
}: {
    openerLabel: string;
}) {
    const [open, setOpen] = React.useState(false);
    return (
        <>
            <button onClick={() => setOpen(true)}>{openerLabel}</button>
            <AppModal open={open} onClose={() => setOpen(false)}>
                <div>
                    <h2>{`Conteudo ${openerLabel}`}</h2>
                    <button onClick={() => setOpen(false)}>{`fechar ${openerLabel}`}</button>
                </div>
            </AppModal>
        </>
    );
}

function getBodyStyles() {
    const body = document.body as HTMLBodyElement;
    const html = document.documentElement as HTMLElement;
    return {
        bodyOverflow: body.style.overflow,
        htmlOverflow: html.style.overflow,
        bodyPosition: body.style.position,
    };
}

describe('AppModal scroll lock', () => {
    // Silence React act(...) warnings from transition timing in tests
    let originalError: (...args: unknown[]) => void;
    beforeAll(() => {
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
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });
    it('locks and unlocks body scroll correctly', async () => {
        const user = userEvent.setup();
        // Initial render open
        render(<ModalHarness initiallyOpen={true} />);

        // After open: overflow hidden should be applied (lock)
        const openedStyles = getBodyStyles();
        // We don't assert exact values for robustness, but at least overflow hidden expected on html or body
        const hasLock =
            openedStyles.bodyOverflow === 'hidden' ||
            openedStyles.htmlOverflow === 'hidden';
        expect(hasLock).toBe(true);

        // Close modal
        // Existem dois botões com nome Fechar (X e nosso). Pegamos o de texto simples.
        const closeBtn = await screen.findByText(/^fechar$/i);
        await user.click(closeBtn);

        // Wait until scroll is restored (neither html nor body overflow remains hidden)
        await waitFor(() => {
            const s = getBodyStyles();
            const stillLocked =
                s.bodyOverflow === 'hidden' || s.htmlOverflow === 'hidden';
            expect(stillLocked).toBe(false);
        });
    });

    it('relocks when reopened and restores again', async () => {
        const user = userEvent.setup();
        render(<ModalHarness initiallyOpen={false} />);
        const opener = screen.getByRole('button', { name: /open/i });

        // Open
        await user.click(opener);
        await waitFor(() => {
            const styles = getBodyStyles();
            const locked =
                styles.bodyOverflow === 'hidden' ||
                styles.htmlOverflow === 'hidden';
            expect(locked).toBe(true);
        });

        // Close
        const closeBtn = await screen.findByText(/^fechar$/i);
        await user.click(closeBtn);
        await waitFor(() => {
            const styles = getBodyStyles();
            const unlocked = !(
                styles.bodyOverflow === 'hidden' ||
                styles.htmlOverflow === 'hidden'
            );
            expect(unlocked).toBe(true);
        });
    });

    it('prevents outside scroll while open (wheel)', async () => {
        const user = userEvent.setup();
        render(
            <div>
                <div data-testid='below-page' style={{ height: 2000 }} />
                <ModalHarness initiallyOpen={true} />
            </div>,
        );

        // Spy on preventDefault via a synthetic wheel event dispatched on document
        const ev = new WheelEvent('wheel', { cancelable: true });
        const preventedBefore = !document.dispatchEvent(ev);
        // If our listener called preventDefault, dispatchEvent returns false
        expect(preventedBefore).toBe(true);

        // Close modal
        const closeBtn = await screen.findByText(/^fechar$/i);
        await user.click(closeBtn);
        await waitFor(() => {
            const styles = getBodyStyles();
            const unlocked = !(
                styles.bodyOverflow === 'hidden' ||
                styles.htmlOverflow === 'hidden'
            );
            expect(unlocked).toBe(true);
        });

        const ev2 = new WheelEvent('wheel', { cancelable: true });
        const preventedAfter = !document.dispatchEvent(ev2);
        expect(preventedAfter).toBe(false);
    });

    it('global unlock fallback uses the latest modal restore callback', async () => {
        const user = userEvent.setup();
        render(
            <>
                <NamedModalHarness openerLabel='open A' />
                <NamedModalHarness openerLabel='open B' />
            </>,
        );

        // Open A → scroll locked
        await user.click(screen.getByRole('button', { name: 'open A' }));
        await waitFor(() => {
            const { bodyOverflow, htmlOverflow } = getBodyStyles();
            expect(
                bodyOverflow === 'hidden' || htmlOverflow === 'hidden',
            ).toBe(true);
        });

        // Close A → scroll restored
        await user.click(screen.getByRole('button', { name: 'fechar open A' }));
        await waitFor(() => {
            const { bodyOverflow, htmlOverflow } = getBodyStyles();
            expect(
                bodyOverflow === 'hidden' || htmlOverflow === 'hidden',
            ).toBe(false);
        });

        // Open B → scroll locked again
        await user.click(screen.getByRole('button', { name: 'open B' }));
        await waitFor(() => {
            const { bodyOverflow, htmlOverflow } = getBodyStyles();
            expect(
                bodyOverflow === 'hidden' || htmlOverflow === 'hidden',
            ).toBe(true);
        });

        // Close B → scroll restored again
        await user.click(screen.getByRole('button', { name: 'fechar open B' }));
        await waitFor(() => {
            const { bodyOverflow, htmlOverflow } = getBodyStyles();
            expect(
                bodyOverflow === 'hidden' || htmlOverflow === 'hidden',
            ).toBe(false);
        });
    });
});
