import { describe, test, expect } from 'vitest';
import { getNow } from '../now';

describe('getNow', () => {
    test('falls back to local Date when provider not set', () => {
        const a = getNow();
        const b = Date.now();
        expect(Math.abs(a.getTime() - b)).toBeLessThan(50);
    });
    test('returns a Date close to system time', () => {
        const before = Date.now();
        const got = getNow();
        const after = Date.now();
        expect(got.getTime()).toBeGreaterThanOrEqual(before);
        expect(got.getTime()).toBeLessThanOrEqual(after);
    });
});
