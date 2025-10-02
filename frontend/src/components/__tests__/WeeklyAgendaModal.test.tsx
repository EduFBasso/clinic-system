import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WeeklyAgendaModal from '../WeeklyAgendaModal';

// Fixed reference date for deterministic assertions
const FIXED_NOW = new Date('2025-10-01T10:00:00'); // 1 Oct 2025 (Wednesday)

describe('WeeklyAgendaModal', () => {
    it('highlights today on open and shows today column selected', () => {
        render(
            <WeeklyAgendaModal
                open={true}
                onClose={() => {}}
                initialDate={FIXED_NOW}
            />,
        );

        // Find weekday selector strip buttons
        // We expect one of the day buttons to have the underline (aria-pressed=true)
        const buttons = screen.getAllByRole('button');
        const dayButtons = buttons.filter(
            btn => btn.getAttribute('aria-pressed') !== null,
        );

        // At least one day button must be present
        expect(dayButtons.length).toBeGreaterThan(0);

        const selected = dayButtons.find(
            btn => btn.getAttribute('aria-pressed') === 'true',
        );
        expect(selected).toBeTruthy();
        expect(selected?.textContent || '').toContain('01');
    });

    it('clicking Hoje selects today immediately (aria-pressed on today)', () => {
        render(
            <WeeklyAgendaModal
                open={true}
                onClose={() => {}}
                initialDate={FIXED_NOW}
            />,
        );

        // Click a different day (first button with aria-pressed attr)
        const buttons = screen.getAllByRole('button');
        const dayButtons = buttons.filter(
            btn => btn.getAttribute('aria-pressed') !== null,
        );
        expect(dayButtons.length).toBeGreaterThan(0);
        dayButtons[0].click();

        // Now click Hoje and expect selection on today's button
        const hojeBtn = screen.getByRole('button', { name: /ir para hoje/i });
        hojeBtn.click();

        const buttons2 = screen.getAllByRole('button');
        const dayButtons2 = buttons2.filter(
            btn => btn.getAttribute('aria-pressed') !== null,
        );
        const selected = dayButtons2.find(
            btn => btn.getAttribute('aria-pressed') === 'true',
        );
        expect(selected).toBeTruthy();
        expect(selected?.textContent || '').toContain('01');
    });
});
