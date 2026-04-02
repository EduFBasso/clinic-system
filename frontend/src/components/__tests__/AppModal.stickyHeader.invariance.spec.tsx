import React from 'react';
import { describe, it, expect, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import DailyAgendaModal from '../DailyAgendaModal';
import WeeklyAgendaModal from '../WeeklyAgendaModal';

// We rely on the real AppModal inside each AgendaModal. JSDOM scrolling is shallow, so we simulate by mutating scrollTop on the modal root.

function getModalScrollable(): HTMLElement | null {
    // Modal Box role='dialog'
    return document.querySelector('[role="dialog"]') as HTMLElement | null;
}

function getHeaderEl(): HTMLElement | null {
    const candidates = Array.from(
        document.querySelectorAll<HTMLElement>('[style]'),
    ).filter(el => el.style.position === 'sticky');
    // Prefer one containing expected phrases
    const preferred = candidates.find(el =>
        /Agenda diária|Agenda Semanal/i.test(el.textContent || ''),
    );
    return preferred || candidates[0] || null;
}

function simulateScroll(scrollTop: number) {
    const scrollable = getModalScrollable();
    if (!scrollable) return;
    Object.defineProperty(scrollable, 'scrollTop', {
        value: scrollTop,
        configurable: true,
        writable: true,
    });
    // Fire a scroll event so AppModal listeners recompute if needed
    scrollable.dispatchEvent(new Event('scroll'));
}

describe('AppModal sticky header invariance', () => {
    beforeAll(() => {
        const g = globalThis as unknown as {
            ResizeObserver?: typeof ResizeObserver;
        };
        if (!g.ResizeObserver) {
            g.ResizeObserver = class {
                observe() {}
                disconnect() {}
            } as unknown as typeof ResizeObserver;
        }
    });
    it('DailyAgendaModal header stays at ~top after scroll', () => {
        const { unmount } = render(
            <DailyAgendaModal open date={new Date()} onClose={() => {}} />,
        );
        const header = getHeaderEl();
        expect(header).toBeTruthy();
        const initialTop = header!.getBoundingClientRect().top;
        simulateScroll(800);
        const afterTop = header!.getBoundingClientRect().top;
        // Allow small deviation (layout rounding) but not large (>10px)
        expect(Math.abs(afterTop - initialTop)).toBeLessThanOrEqual(10);
        unmount();
    });

    it('WeeklyAgendaModal header stays at ~top after scroll', () => {
        const { unmount } = render(
            <WeeklyAgendaModal
                open
                initialDate={new Date()}
                onClose={() => {}}
            />,
        );
        const header = getHeaderEl();
        expect(header).toBeTruthy();
        const initialTop = header!.getBoundingClientRect().top;
        simulateScroll(900);
        const afterTop = header!.getBoundingClientRect().top;
        expect(Math.abs(afterTop - initialTop)).toBeLessThanOrEqual(10);
        unmount();
    });
});
