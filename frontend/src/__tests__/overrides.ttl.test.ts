import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    setAppointmentOverride,
    getAppointmentOverride,
    __clearOverridesForTests,
    __forceSweepOverridesTTL,
    __setOverrideTimestampForTests,
    __OVERRIDE_TTL_MS,
} from '../utils/appointments/overrides';

// Testa comportamento de expiração TTL (60m) somente para estados finais.
describe('overrides TTL cleanup', () => {
    const baseNow = Date.now();
    beforeEach(() => {
        __clearOverridesForTests();
        vi.useFakeTimers();
        vi.setSystemTime(baseNow);
    });

    it('não expira overrides não finais (scheduled) mesmo após TTL', () => {
        setAppointmentOverride(1, { status: 'scheduled' });
        __setOverrideTimestampForTests(
            1,
            baseNow - (__OVERRIDE_TTL_MS + 5 * 60 * 1000),
        );
        __forceSweepOverridesTTL(baseNow);
        expect(getAppointmentOverride(1)).toBeTruthy();
    });

    it('expira overrides finalizados após TTL', () => {
        setAppointmentOverride(2, {
            status: 'done',
            real_closed_at: new Date(baseNow).toISOString(),
            real_closed_reason: 'done',
        });
        __setOverrideTimestampForTests(2, baseNow - (__OVERRIDE_TTL_MS + 1000));
        __forceSweepOverridesTTL(baseNow);
        expect(getAppointmentOverride(2)).toBeUndefined();
    });

    it('mantém overrides finais antes do TTL', () => {
        setAppointmentOverride(3, {
            status: 'canceled',
            real_closed_at: new Date(baseNow).toISOString(),
            real_closed_reason: 'canceled',
        });
        __setOverrideTimestampForTests(
            3,
            baseNow - (__OVERRIDE_TTL_MS - 5 * 60 * 1000),
        );
        __forceSweepOverridesTTL(baseNow);
        expect(getAppointmentOverride(3)).toBeTruthy();
    });
});
