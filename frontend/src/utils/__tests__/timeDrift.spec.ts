import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    getActiveDrift,
    getDriftSnapshot,
    measureDrift,
    resetDriftState,
} from '../../utils/timeDrift';

// Mock getServerNowOnce via jest/vi by mocking services/time module
vi.mock('../../services/time', () => ({
    getServerNowOnce: vi.fn(async () => null),
}));

import { getServerNowOnce } from '../../services/time';

describe('timeDrift utility', () => {
    const baseNow = new Date('2025-10-06T15:00:00Z').getTime();
    let dateNowSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        resetDriftState();
        dateNowSpy = vi.spyOn(Date, 'now').mockImplementation(() => baseNow);
        (
            getServerNowOnce as unknown as {
                mockResolvedValue: (v: Date) => void;
            }
        ).mockResolvedValue(new Date(baseNow + 120000)); // +2min
    });

    afterEach(() => {
        dateNowSpy.mockRestore();
        vi.clearAllMocks();
    });

    it('computes positive drift when server is ahead', async () => {
        const drift = await measureDrift(true);
        // Expect approx 120000 (allow small deviation if midpoint calc changed)
        expect(Math.abs(drift - 120000)).toBeLessThan(5);
        const snap = getDriftSnapshot();
        expect(snap).not.toBeNull();
        expect(getActiveDrift()).toBe(drift);
    });

    it('returns cached drift without remeasure if called quickly', async () => {
        const d1 = await measureDrift(true);
        (
            getServerNowOnce as unknown as {
                mockResolvedValue: (v: Date) => void;
            }
        ).mockResolvedValue(new Date(baseNow + 180000)); // would be +3min if re-measured
        const d2 = await measureDrift(false); // should not remeasure due interval guard
        expect(d2).toBe(d1);
    });
});
