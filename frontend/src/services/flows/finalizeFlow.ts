import { API_BASE } from '../../config/api';
import ensureDeviceSession from '../sessions';
import { buildDeviceHeaders } from '../device';
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

async function forceAdjust(apptId: number): Promise<boolean> {
    const appt = await fetchAppt(apptId);
    if (!appt) return false;
    if (appt.status !== 'scheduled') return true; // already closed
    const serverNow = await getServerNowOnce();
    const now = serverNow ?? new Date();
    const nowMs = now.getTime();
    const startMs = new Date(appt.start_at).getTime();
    const endMs = new Date(appt.end_at).getTime();
    let body: Record<string, unknown> = { status: 'done' };
    if (!Number.isNaN(startMs) && nowMs < startMs) {
        const newStart = new Date(nowMs);
        const newEnd = new Date(nowMs + 1000);
        body = {
            status: 'done',
            start_at: newStart.toISOString(),
            end_at: newEnd.toISOString(),
        };
    } else if (
        !Number.isNaN(startMs) &&
        !Number.isNaN(endMs) &&
        startMs <= nowMs &&
        nowMs < endMs
    ) {
        body = { status: 'done', end_at: new Date(nowMs).toISOString() };
    }
    const token = localStorage.getItem('accessToken') || '';
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    Object.assign(headers, buildDeviceHeaders());
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
        const r = await fetch(`${API_BASE}/agenda/appointments/${apptId}/`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(body),
        });
        if (r.ok) {
            log('force-adjust-success', { apptId });
            return true;
        }
        const txt = await r.text().catch(() => '');
        log('force-adjust-fail', { apptId, status: r.status, txt });
    } catch (e) {
        log('force-adjust-error', { apptId, error: String(e) });
    }
    return false;
}

export async function finalizeFlow(
    apptId: number,
): Promise<FinalizeFlowResult> {
    const t0 = performance.now();
    // Tentar capturar hora final ORIGINAL antes de qualquer ajuste (dataset atribuído nos cards)
    let originalEnd: string | undefined;
    // Fetch prévio (caso card não esteja montado) para preservar end original
    try {
        const pre = await fetchAppt(apptId);
        if (pre?.end_at) originalEnd = pre.end_at;
    } catch {
        /* noop */
    }
    try {
        const el = document.querySelector(
            `[data-appt-id="${apptId}"]`,
        ) as HTMLElement | null;
        if (el) {
            const attr = el.getAttribute('data-original-end-at');
            if (attr) originalEnd = attr;
            // Back-compat: se ainda não migrado
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
    const headers: Record<string, string> = {};
    Object.assign(headers, buildDeviceHeaders(), {
        'X-Client-Now': new Date().toISOString(),
    });
    if (token) headers['Authorization'] = `Bearer ${token}`;
    let r: Response | null = null;
    try {
        r = await fetch(`${API_BASE}/agenda/appointments/${apptId}/finalize/`, {
            method: 'POST',
            headers,
        });
    } catch (e) {
        log('network-fail-post', { apptId, error: String(e) });
        return { ok: false, error: 'Network error' };
    }

    if (r && (r.status === 401 || r.status === 403)) {
        try {
            await ensureDeviceSession(true);
        } catch {
            /* ignore session refresh fail */
        }
        try {
            r = await fetch(
                `${API_BASE}/agenda/appointments/${apptId}/finalize/`,
                { method: 'POST', headers },
            );
        } catch {
            /* ignore retry network error */
        }
    }
    if (r && r.ok) {
        const serverNow = await getServerNowOnce();
        const nowIso = (serverNow ?? new Date()).toISOString();
        setAppointmentOverride(apptId, {
            status: 'done',
            real_closed_at: nowIso,
            real_closed_reason: 'done',
            ...(originalEnd ? { original_end_at: originalEnd } : null),
        });
        try {
            window.dispatchEvent(new Event('pendingActions:forceClose'));
        } catch {
            /* noop */
        }
        log('optimistic-done', { apptId, status: r.status });
        return { ok: true, status: r.status };
    }
    if (r && r.status === 422) {
        try {
            const data = await r.json();
            if (data?.code === 'too_early') {
                log('too-early', { apptId });
                const forced = await forceAdjust(apptId);
                if (forced) {
                    const serverNow = await getServerNowOnce();
                    const nowIso = (serverNow ?? new Date()).toISOString();
                    setAppointmentOverride(apptId, {
                        status: 'done',
                        real_closed_at: nowIso,
                        real_closed_reason: 'done',
                        ...(originalEnd
                            ? { original_end_at: originalEnd }
                            : null),
                    });
                    try {
                        window.dispatchEvent(
                            new Event('pendingActions:forceClose'),
                        );
                    } catch {
                        /* noop */
                    }
                    return { ok: true, status: 200, adjusted: true };
                }
            }
        } catch {
            /* ignore parse or forceAdjust error */
        }
    }
    // Alias endpoint fallback
    try {
        const aliasHeaders: Record<string, string> = {};
        Object.assign(aliasHeaders, buildDeviceHeaders(), {
            'X-Client-Now': new Date().toISOString(),
        });
        if (token) aliasHeaders['Authorization'] = `Bearer ${token}`;
        const rAlias = await fetch(
            `${API_BASE}/agenda/appointments/${apptId}/done/`,
            { method: 'POST', headers: aliasHeaders },
        );
        if (rAlias.ok) {
            const serverNow = await getServerNowOnce();
            const nowIso = (serverNow ?? new Date()).toISOString();
            setAppointmentOverride(apptId, {
                status: 'done',
                real_closed_at: nowIso,
                real_closed_reason: 'done',
                ...(originalEnd ? { original_end_at: originalEnd } : null),
            });
            try {
                window.dispatchEvent(new Event('pendingActions:forceClose'));
            } catch {
                /* noop */
            }
            log('alias-success', { apptId, status: rAlias.status });
            return { ok: true, status: rAlias.status };
        }
    } catch (e) {
        log('alias-error', { apptId, error: String(e) });
    }

    // Force adjust final fallback
    if (await forceAdjust(apptId)) {
        const serverNow = await getServerNowOnce();
        const nowIso = (serverNow ?? new Date()).toISOString();
        setAppointmentOverride(apptId, {
            status: 'done',
            real_closed_at: nowIso,
            real_closed_reason: 'done',
            ...(originalEnd ? { original_end_at: originalEnd } : null),
        });
        try {
            window.dispatchEvent(new Event('pendingActions:forceClose'));
        } catch {
            /* noop */
        }
        log('force-final-fallback', { apptId });
        return { ok: true, status: 200, adjusted: true };
    }
    const elapsed = Math.round(performance.now() - t0);
    log('finalize-fail', { apptId, elapsed, status: r?.status });
    return { ok: false, status: r?.status, error: 'Finalize failed' };
}
