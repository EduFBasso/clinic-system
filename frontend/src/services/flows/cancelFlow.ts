import { apiFetch, ApiError } from '../../utils/apiFetch';
import ensureDeviceSession from '../sessions';
import { getServerNowOnce } from '../time';
import { setAppointmentOverride } from '../../utils/appointments/overrides';
import { emit } from '../../events/bus';

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
        return await apiFetch(
            `/agenda/appointments/${id}/?ts=${Date.now()}`,
            { cache: 'no-store' },
        ) as { id: number; start_at: string; end_at: string; status: string };
    } catch {
        return null;
    }
}

export async function cancelFlow(apptId: number): Promise<CancelFlowResult> {
    const t0 = performance.now();
    let originalEnd: string | undefined;
    try {
        const el = document.querySelector(`[data-appt-id="${apptId}"]`) as HTMLElement | null;
        if (el) {
            const attr = el.getAttribute('data-original-end-at');
            if (attr) originalEnd = attr;
            if (!originalEnd) {
                const legacy = el.getAttribute('data-end-at');
                if (legacy) originalEnd = legacy;
            }
        }
    } catch { /* noop */ }
    await ensureDeviceSession().catch(() => {});

    // 1. POST /cancel/
    let postStatus = 0;
    try {
        await apiFetch(`/agenda/appointments/${apptId}/cancel/`, {
            method: 'POST',
            cache: 'no-store',
        });
        postStatus = 200;
    } catch (e) {
        const err = e as ApiError | Error;
        const status = (err as ApiError).status ?? 0;
        if (status === 0) {
            log('network-fail-post', { apptId, error: err.message });
            return { ok: false, status: 0, error: 'Network error' };
        }
        log('post-fail', { apptId, status, text: err.message });
        return { ok: false, status, error: err.message || `HTTP ${status}` };
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
        try { emit('pendingActions:forceClose', undefined); } catch { /* noop */ }
    } catch { /* ignore override set failure */ }
    log('optimistic-set', { apptId, nowIso });

    // 3. Attempt targeted end_at shortening only if in-progress
    let patchedEnd = false;
    try {
        const appt = await fetchAppt(apptId);
        if (appt && appt.status === 'canceled') {
            log('fetch-after-cancel', { apptId, status: appt.status });
        } else if (appt && appt.status === 'scheduled') {
            const startMs = new Date(appt.start_at).getTime();
            const endMs = new Date(appt.end_at).getTime();
            const nowMs = now.getTime();
            if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && startMs <= nowMs && nowMs < endMs) {
                try {
                    await apiFetch(`/agenda/appointments/${apptId}/`, {
                        method: 'PATCH',
                        body: { end_at: nowIso },
                    });
                    patchedEnd = true;
                    setAppointmentOverride(apptId, { end_at: nowIso });
                    log('shorten-end-success', { apptId });
                } catch (e) {
                    const err = e as ApiError | Error;
                    log('shorten-end-fail', { apptId, status: (err as ApiError).status, txt: err.message });
                }
            }
        }
    } catch (e) {
        log('shorten-end-error', { apptId, error: String(e) });
    }

    const elapsed = Math.round(performance.now() - t0);
    log('done', { apptId, elapsed, patchedEnd });
    return { ok: true, status: postStatus, patchedEnd };
}
