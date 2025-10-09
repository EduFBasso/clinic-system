import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { finalizeFlow } from '../services/flows/finalizeFlow';
import {
    getAppointmentOverride,
    __clearOverridesForTests,
} from '../utils/appointments/overrides';

// Mock modules used inside finalizeFlow to isolate logic
vi.mock('../services/sessions', () => ({ default: () => Promise.resolve() }));
vi.mock('../services/device', () => ({
    buildDeviceHeaders: () => ({ 'X-Device': 'test' }),
}));
vi.mock('../services/time', () => ({
    getServerNowOnce: () =>
        Promise.resolve(new Date('2025-01-01T00:00:00.000Z')),
}));

interface MockRespOpts {
    status: number;
    json?: unknown;
    text?: string;
    headers?: Record<string, string>;
}

function mockResponse({
    status,
    json,
    text,
    headers = {},
}: MockRespOpts): Response {
    return new Response(json ? JSON.stringify(json) : text || '', {
        status,
        headers,
    });
}

// Helper para instalar fetch mock de forma tipada
function mockFetch(
    impl: (url: string, init?: RequestInit) => Promise<Response>,
) {
    return vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
            const url =
                typeof input === 'string'
                    ? input
                    : input instanceof URL
                    ? input.toString()
                    : (input as Request).url;
            return impl(url, init);
        });
}

describe('finalizeFlow', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        // Simple in-memory localStorage mock
        const store: Record<string, string> = {};
        // @ts-expect-error test shim
        global.localStorage = {
            getItem: (k: string) => (k in store ? store[k] : null),
            setItem: (k: string, v: string) => {
                store[k] = v;
            },
            removeItem: (k: string) => {
                delete store[k];
            },
            clear: () => {
                Object.keys(store).forEach(k => delete store[k]);
            },
        };
        localStorage.setItem('accessToken', 'tok');
        __clearOverridesForTests();
    });
    afterEach(() => {
        __clearOverridesForTests();
    });

    it('finaliza direto (POST /finalize/ 200)', async () => {
        const apptId = 101;
        const fetchSpy = mockFetch(async url => {
            if (url.endsWith(`/finalize/`)) {
                return mockResponse({ status: 200, json: { ok: true } });
            }
            if (url.includes(`/appointments/${apptId}/?`)) {
                return mockResponse({
                    status: 200,
                    json: {
                        id: apptId,
                        start_at: new Date(Date.now() - 600000).toISOString(),
                        end_at: new Date(Date.now() + 600000).toISOString(),
                        status: 'scheduled',
                    },
                });
            }
            return mockResponse({ status: 404 });
        });

        const res = await finalizeFlow(apptId);
        expect(res.ok).toBe(true);
        expect(res.status).toBe(200);
        const ov = getAppointmentOverride(apptId);
        expect(ov?.status).toBe('done');
        expect(fetchSpy).toHaveBeenCalled();
    });

    it('caminho too_early -> forceAdjust fallback', async () => {
        const apptId = 202;
        const start = new Date(Date.now() + 10 * 60000); // futuro
        const end = new Date(start.getTime() + 30 * 60000);
        let forcePatched = false;
        const fetchSpy = mockFetch(async (url, init) => {
            if (url.endsWith(`/finalize/`)) {
                return mockResponse({
                    status: 422,
                    json: { code: 'too_early' },
                });
            }
            if (url.includes(`/appointments/${apptId}/?`)) {
                return mockResponse({
                    status: 200,
                    json: {
                        id: apptId,
                        start_at: start.toISOString(),
                        end_at: end.toISOString(),
                        status: 'scheduled',
                    },
                });
            }
            if (url.endsWith(`/appointments/${apptId}/`)) {
                if (init?.method === 'PATCH') {
                    forcePatched = true;
                    return mockResponse({ status: 200, json: { id: apptId } });
                }
            }
            return mockResponse({ status: 404 });
        });

        const res = await finalizeFlow(apptId);
        expect(res.ok).toBe(true);
        expect(res.adjusted).toBe(true);
        expect(forcePatched).toBe(true);
        const ov = getAppointmentOverride(apptId);
        expect(ov?.status).toBe('done');
        expect(fetchSpy).toHaveBeenCalled();
    });
});
