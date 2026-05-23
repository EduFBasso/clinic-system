import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DailyAgendaModal } from '../DailyAgendaModal/DailyAgendaModal';
import { WeeklyAgendaModal } from '../WeeklyAgendaModal/WeeklyAgendaModal';

// Helper to snapshot lock-related styles/classes
function getLockSnapshot() {
    const body = document.body;
    const html = document.documentElement;
    return {
        bodyOverflow: body.style.overflow,
        bodyPosition: body.style.position,
        htmlOverflow: html.style.overflow,
        bodyHasMui: body.classList.contains('MuiModal-open'),
        htmlHasMui: html.classList.contains('MuiModal-open'),
    };
}

describe('AppModal cross-modal isolation', () => {
    it('closing Daily then opening Weekly leaves no stale locks', async () => {
        const onClose = () => {};
        // Step 1: open Daily
        const utils = render(
            <DailyAgendaModal open date={new Date()} onClose={onClose} />,
        );
        // Simulate close: rerender with open false
        utils.rerender(
            <DailyAgendaModal
                open={false}
                date={new Date()}
                onClose={onClose}
            />,
        );
        await new Promise(r => setTimeout(r, 5));
        const afterDailyClose = getLockSnapshot();
        expect(['', 'hidden']).toContain(afterDailyClose.bodyOverflow);
        expect(['', 'hidden']).toContain(afterDailyClose.htmlOverflow);
        // Step 2: open Weekly
        utils.rerender(
            <WeeklyAgendaModal
                open
                initialDate={new Date()}
                onClose={onClose}
            />,
        );
        // Then close Weekly
        utils.rerender(
            <WeeklyAgendaModal
                open={false}
                initialDate={new Date()}
                onClose={onClose}
            />,
        );
        await new Promise(r => setTimeout(r, 5));
        const afterWeeklyClose = getLockSnapshot();
        expect(['', 'hidden']).toContain(afterWeeklyClose.bodyOverflow);
        expect(['', 'hidden']).toContain(afterWeeklyClose.htmlOverflow);
        // No lingering MuiModal-open classes
        expect(afterWeeklyClose.bodyHasMui).toBe(false);
        expect(afterWeeklyClose.htmlHasMui).toBe(false);
    });
});
