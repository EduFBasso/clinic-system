import { API_BASE } from '../../config/api';
import ensureDeviceSession from '../sessions';
import { buildDeviceHeaders } from '../device';
import { getServerNowOnce } from '../time';
import { setAppointmentOverride } from '../../utils/appointments/overrides';

export interface CancelFlowResult {
    ok: boolean;
    status: number;
    error?: string;
    patchedEnd?: boolean;
}

function log(stage: string, payload: Record<string, unknown>) {
    try {
        console.debug('[appt-flow][cancel]', stage, payload);
    } catch {
        /* swallow logging issues */
    }
}

async function fetchAppt(id: number) {
    try {
        const token = localStorage.getItem('accessToken') || '';
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const r = await fetch(
            `${API_BASE}/agenda/appointments/${id}/?ts=${Date.now()}`,
            { headers, cache: 'no-store' },
        );
        if (!r.ok) return null;
        return (await r.json()) as {
            id: number;
            start_at: string;
            end_at: string;
            status: string;
        };
    } catch {
        return null;
    }
}

export async function cancelFlow(apptId: number): Promise<CancelFlowResult> {
    const t0 = performance.now();
    let originalEnd: string | undefined;
    try {
        const el = document.querySelector(
            `[data-appt-id="${apptId}"]`,
        ) as HTMLElement | null;
        if (el) {
            const attr = el.getAttribute('data-original-end-at');
            if (attr) originalEnd = attr;
            if (!originalEnd) {
                const legacy = el.getAttribute('data-end-at');
                if (legacy) originalEnd = legacy;
            }
        }
    } catch {
        /* noop */
    }
    await ensureDeviceSession().catch(() => {});
    const token = localStorage.getItem('accessToken') || '';
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    Object.assign(headers, buildDeviceHeaders());
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // 1. POST /cancel/
    let postResp: Response | null = null;
    try {
        postResp = await fetch(
            `${API_BASE}/agenda/appointments/${apptId}/cancel/`,
            {
                method: 'POST',
                headers,
                cache: 'no-store',
            },
        );
    } catch (e) {
        log('network-fail-post', { apptId, error: String(e) });
        return { ok: false, status: 0, error: 'Network error' };
    }
    if (!postResp.ok) {
        const text = await postResp.text().catch(() => '');
        log('post-fail', { apptId, status: postResp.status, text });
        return {
            ok: false,
            status: postResp.status,
            error: text || `HTTP ${postResp.status}`,
        };
    }
    // 2. Optimistic override
    const now = (await getServerNowOnce()) ?? new Date();
    const nowIso = now.toISOString();
    try {
        setAppointmentOverride(apptId, {
            status: 'canceled',
            real_closed_at: nowIso,
            real_closed_reason: 'canceled',
            ...(originalEnd ? { original_end_at: originalEnd } : null),
        });
        try {
            window.dispatchEvent(new Event('pendingActions:forceClose'));
        } catch {
            /* noop */
        }
    } catch {
        /* ignore override set failure */
    }
    log('optimistic-set', { apptId, nowIso });

    // 3. Attempt targeted end_at shortening only if in-progress
    let patchedEnd = false;
    try {
        const appt = await fetchAppt(apptId);
        if (appt && appt.status === 'canceled') {
            // Already canceled; nothing to shorten now
            log('fetch-after-cancel', { apptId, status: appt.status });
        } else if (appt && appt.status === 'scheduled') {
            const startMs = new Date(appt.start_at).getTime();
            const endMs = new Date(appt.end_at).getTime();
            const nowMs = now.getTime();
            if (
                !Number.isNaN(startMs) &&
                !Number.isNaN(endMs) &&
                startMs <= nowMs &&
                nowMs < endMs
            ) {
                // Shorten end_at only; do NOT include status (already changed by POST)
                const patchHeaders: Record<string, string> = {
                    'Content-Type': 'application/json',
                };
                if (token) patchHeaders['Authorization'] = `Bearer ${token}`;
                Object.assign(patchHeaders, buildDeviceHeaders());
                const body = { end_at: nowIso };
                const pr = await fetch(
                    `${API_BASE}/agenda/appointments/${apptId}/`,
                    {
                        method: 'PATCH',
                        headers: patchHeaders,
                        body: JSON.stringify(body),
                    },
                );
                if (pr.ok) {
                    patchedEnd = true;
                    setAppointmentOverride(apptId, { end_at: nowIso });
                    log('shorten-end-success', { apptId });
                } else {
                    const txt = await pr.text().catch(() => '');
                    log('shorten-end-fail', { apptId, status: pr.status, txt });
                }
            }
        }
    } catch (e) {
        log('shorten-end-error', { apptId, error: String(e) });
    }

    const elapsed = Math.round(performance.now() - t0);
    log('done', { apptId, elapsed, patchedEnd });
    return { ok: true, status: postResp.status, patchedEnd };
}
