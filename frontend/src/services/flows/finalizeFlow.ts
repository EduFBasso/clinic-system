import { apiFetch, ApiError } from '../../utils/apiFetch';
import ensureDeviceSession from '../sessions';
import { getServerNowOnce } from '../time';
import { setAppointmentOverride } from '../../utils/appointments/overrides';

export interface FinalizeFlowResult {
    ok: boolean;
    status?: number;
    error?: string;
    adjusted?: boolean;
}
function log(stage: string, payload: Record<string, unknown>) {
    try {
        console.debug('[appt-flow][finalize]', stage, payload);
    } catch {
        /* noop */
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

async function forceAdjust(apptId: number): Promise<boolean> {
    const appt = await fetchAppt(apptId);
    if (!appt) return false;
    if (appt.status !== 'scheduled') return true;
    const serverNow = await getServerNowOnce();
    const now = serverNow ?? new Date();
    const nowMs = now.getTime();
    const startMs = new Date(appt.start_at).getTime();
    const endMs = new Date(appt.end_at).getTime();
    let body: Record<string, unknown> = { status: 'pending' };
    if (!Number.isNaN(startMs) && nowMs < startMs) {
        body = { status: 'pending', start_at: new Date(nowMs).toISOString(), end_at: new Date(nowMs + 1000).toISOString() };
    } else if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && startMs <= nowMs && nowMs < endMs) {
        body = { status: 'pending', end_at: new Date(nowMs).toISOString() };
    }
    try {
        await apiFetch(`/agenda/appointments/${apptId}/`, { method: 'PATCH', body });
        log('force-adjust-success', { apptId });
        return true;
    } catch (e) {
        const err = e as ApiError | Error;
        log('force-adjust-fail', { apptId, status: (err as ApiError).status, txt: err.message });
        return false;
    }
}

export async function finalizeFlow(
    apptId: number,
): Promise<FinalizeFlowResult> {
    const t0 = performance.now();
    let originalEnd: string | undefined;
    try {
        const pre = await fetchAppt(apptId);
        if (pre?.end_at) originalEnd = pre.end_at;
    } catch { /* noop */ }
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

    let finalizeOk = false;
    let finalizeStatus: number | undefined;
    let tooEarly = false;
    try {
        const data = await apiFetch(`/agenda/appointments/${apptId}/finalize/`, {
            method: 'POST',
            headers: { 'X-Client-Now': new Date().toISOString() },
        }) as { end_at?: string; status?: string } | null;
        finalizeOk = true;
        finalizeStatus = 200;
        const serverNow = await getServerNowOnce();
        const nowIso = (serverNow ?? new Date()).toISOString();
        setAppointmentOverride(apptId, {
            status: 'pending',
            end_at: data?.end_at || nowIso,
            ...(originalEnd ? { original_end_at: originalEnd } : null),
        });
        log('optimistic-pending', { apptId, status: finalizeStatus, data });
    } catch (e) {
        const err = e as ApiError | Error;
        finalizeStatus = (err as ApiError).status ?? 0;
        if (finalizeStatus === 422) {
            tooEarly = true;
        } else if (finalizeStatus === 0) {
            log('network-fail-post', { apptId, error: err.message });
            return { ok: false, error: 'Network error' };
        }
    }

    if (finalizeOk) return { ok: true, status: finalizeStatus };

    if (tooEarly) {
        log('too-early', { apptId });
        const forced = await forceAdjust(apptId);
        if (forced) {
            const serverNow = await getServerNowOnce();
            const nowIso = (serverNow ?? new Date()).toISOString();
            setAppointmentOverride(apptId, {
                status: 'pending',
                end_at: nowIso,
                ...(originalEnd ? { original_end_at: originalEnd } : null),
            });
            return { ok: true, status: 200, adjusted: true };
        }
    }

    const elapsed = Math.round(performance.now() - t0);
    log('finalize-fail', { apptId, elapsed, status: finalizeStatus });
    return { ok: false, status: finalizeStatus, error: 'Finalize failed' };
}
