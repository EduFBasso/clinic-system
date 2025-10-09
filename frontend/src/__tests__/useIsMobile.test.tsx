import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useIsMobile from '../hooks/useIsMobile';

// Helper to simulate resize
function resizeTo(width: number) {
    // Cast window to allow assignment in test environment
    (window as unknown as { innerWidth: number }).innerWidth = width;
    window.dispatchEvent(new Event('resize'));
}

describe('useIsMobile (unified)', () => {
    beforeEach(() => {
        resizeTo(1024); // reset baseline
    });

    it('returns false when width > default breakpoint (900)', () => {
        const { result } = renderHook(() => useIsMobile());
        expect(result.current).toBe(false);
    });

    it('returns true when resized below breakpoint', () => {
        const { result } = renderHook(() => useIsMobile());
        act(() => resizeTo(800));
        expect(result.current).toBe(true);
    });

    it('respects custom breakpoint parameter', () => {
        const { result } = renderHook(() => useIsMobile(500));
        act(() => resizeTo(600));
        expect(result.current).toBe(false);
        act(() => resizeTo(480));
        expect(result.current).toBe(true);
    });
});
