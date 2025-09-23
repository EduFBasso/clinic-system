import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AppModal from '../Modal';

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
    it('locks and unlocks body scroll correctly', async () => {
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
        fireEvent.click(closeBtn);

        // Allow effects + timeouts to run (AppModal schedules multiple restores)
        await new Promise(r => setTimeout(r, 500));

        const closedStyles = getBodyStyles();
        // Scroll should be restored: neither body nor html should keep hidden (unless another modal stayed open)
        const stillLocked =
            closedStyles.bodyOverflow === 'hidden' ||
            closedStyles.htmlOverflow === 'hidden';
        expect(stillLocked).toBe(false);
    });

    it('relocks when reopened and restores again', async () => {
        render(<ModalHarness initiallyOpen={false} />);
        const opener = screen.getByRole('button', { name: /open/i });

        // Open
        fireEvent.click(opener);
        await new Promise(r => setTimeout(r, 50));
        let styles = getBodyStyles();
        const locked =
            styles.bodyOverflow === 'hidden' ||
            styles.htmlOverflow === 'hidden';
        expect(locked).toBe(true);

        // Close
        const closeBtn = await screen.findByText(/^fechar$/i);
        fireEvent.click(closeBtn);
        await new Promise(r => setTimeout(r, 400));
        styles = getBodyStyles();
        const unlocked = !(
            styles.bodyOverflow === 'hidden' || styles.htmlOverflow === 'hidden'
        );
        expect(unlocked).toBe(true);
    });
});
