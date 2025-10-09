import { describe, it, expect, beforeEach } from 'vitest';
import {
    computeBottomComp,
    updateDynamicVhVar,
    applyBottomCompVar,
} from '../modal/viewportCompensation';

// Helper: monkey patch visualViewport height for tests without redefining types.
function mockVisualViewport(height: number | undefined) {
    const w = window as unknown as { visualViewport?: { height: number } };
    if (height === undefined) {
        if ('visualViewport' in w) delete w.visualViewport;
    } else {
        w.visualViewport = { height };
    }
}

describe('viewportCompensation utils', () => {
    beforeEach(() => {
        document.documentElement.style.removeProperty(
            '--_fake_safe_area_bottom',
        );
        document.documentElement.style.removeProperty('--appmodal-vh');
    });

    it('returns zero bottomComp when no visualViewport', () => {
        mockVisualViewport(undefined);
        const m = computeBottomComp();
        expect(m.bottomComp).toBe(0);
    });

    it('returns zero when delta <= 8', () => {
        mockVisualViewport(window.innerHeight - 5); // delta 5 <= 8
        const m = computeBottomComp();
        expect(m.bottomComp).toBe(0);
    });

    it('subtracts fake safe area when delta > 8', () => {
        document.documentElement.style.setProperty(
            '--_fake_safe_area_bottom',
            '10px',
        );
        // Force delta 40 (so bottomComp = 40 - 10 = 30)
        mockVisualViewport(window.innerHeight - 40);
        const m = computeBottomComp();
        expect(m.bottomComp).toBe(30);
    });

    it('updateDynamicVhVar sets css variable', () => {
        mockVisualViewport(window.innerHeight - 20);
        const vh = updateDynamicVhVar();
        const css = getComputedStyle(document.documentElement).getPropertyValue(
            '--appmodal-vh',
        );
        expect(css.trim()).toBe(`${vh}px`);
    });

    it('applyBottomCompVar writes and removes variable', () => {
        const el = document.createElement('div');
        applyBottomCompVar(el, 25);
        expect(el.style.getPropertyValue('--appmodal-bottom-comp')).toBe(
            '25px',
        );
        applyBottomCompVar(el, 0);
        expect(el.style.getPropertyValue('--appmodal-bottom-comp')).toBe('');
    });
});
