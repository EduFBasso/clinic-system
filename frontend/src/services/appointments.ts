import { API_BASE } from '../config/api';
import { getServerNowOnce } from './time';
import ensureDeviceSession from './sessions';
import { buildDeviceHeaders } from './device';

export async function optionsFinalizeSupported(
    apptId: number,
): Promise<boolean> {
    try {
        const token = localStorage.getItem('accessToken') || '';
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const url = `${API_BASE}/agenda/appointments/${apptId}/finalize/`;
        const r = await fetch(url, { method: 'OPTIONS', headers });
        return r.ok;
    } catch {
        return false;
    }
}

export async function postFinalize(apptId: number): Promise<boolean> {
    try {
        const token = localStorage.getItem('accessToken') || '';
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        Object.assign(headers, buildDeviceHeaders(), {
            'x-client-now': new Date().toISOString(),
        });
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const url = `${API_BASE}/agenda/appointments/${apptId}/finalize/`;
        const r = await fetch(url, { method: 'POST', headers });
        return r.ok;
    } catch {
        return false;
    }
}

export async function postDone(apptId: number): Promise<boolean> {
    try {
        const token = localStorage.getItem('accessToken') || '';
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        Object.assign(headers, buildDeviceHeaders(), {
            'x-client-now': new Date().toISOString(),
        });
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const url = `${API_BASE}/agenda/appointments/${apptId}/done/`;
        const r = await fetch(url, { method: 'POST', headers });
        return r.ok;
    } catch {
        return false;
    }
}

export async function patchStatus(
    apptId: number,
    status: 'done' | 'canceled' | 'scheduled',
): Promise<boolean> {
    try {
        const token = localStorage.getItem('accessToken') || '';
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        Object.assign(headers, buildDeviceHeaders(), {
            'x-client-now': new Date().toISOString(),
        });
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const url = `${API_BASE}/agenda/appointments/${apptId}/`;
        const r = await fetch(url, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ status }),
        });
        return r.ok;
    } catch {
        return false;
    }
}

/**
 * Cancela um compromisso com reforços de sessão e log opcional.
 * - Tenta com o token atual.
 * - Em caso de 401/403, força ensureDeviceSession e repete uma vez.
 */
export async function cancelAppointment(
    apptId: number,
): Promise<{ ok: boolean; status: number; text?: string }> {
    // Best-effort: garanta que a sessão do dispositivo exista antes de bater no endpoint
    try {
        await ensureDeviceSession();
    } catch {
        /* continue anyway */
    }
    async function attempt(): Promise<{
        ok: boolean;
        status: number;
        text?: string;
    }> {
        const token = localStorage.getItem('accessToken') || '';
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        Object.assign(headers, buildDeviceHeaders());
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const url = `${API_BASE}/agenda/appointments/${apptId}/cancel/`;
        try {
            const r = await fetch(url, {
                method: 'POST',
                headers,
                cache: 'no-store',
            });
            const text = await r.text().catch(() => '');
            return { ok: r.ok, status: r.status, text };
        } catch (e) {
            return {
                ok: false,
                status: 0,
                text: String((e as Error)?.message || e),
            };
        }
    }
    let res = await attempt();
    if (res.status === 401 || res.status === 403) {
        try {
            await ensureDeviceSession(true);
        } catch {
            /* ignore */
        }
        res = await attempt();
    }
    return res;
}

/**
 * Cancela um compromisso e, se estiver em andamento, ajusta o end_at para o horário atual.
 * - Usa hora do servidor quando disponível para consistência.
 * - Após POST /cancel/, faz PATCH no recurso principal com end_at encurtado e status 'canceled'.
 */
export async function cancelWithAdjust(
    apptId: number,
): Promise<{ ok: boolean; status: number; text?: string }> {
    // Helper para obter dados do compromisso
    async function getAppt() {
        try {
            const token = localStorage.getItem('accessToken') || '';
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const url = `${API_BASE}/agenda/appointments/${apptId}/?ts=${Date.now()}`;
            const r = await fetch(url, { headers, cache: 'no-store' });
            if (!r.ok) return null;
            const d = (await r.json()) as {
                id: number;
                start_at: string;
                end_at: string;
                status: 'scheduled' | 'done' | 'canceled';
            };
            return d;
        } catch {
            return null;
        }
    }

    const cancelRes = await cancelAppointment(apptId);
    if (!cancelRes.ok) return cancelRes;
    // Tente ajustar o end_at quando fizer sentido, mas não falhe o fluxo se não conseguir
    try {
        const appt = await getAppt();
        if (!appt) return cancelRes; // sem dados, apenas retorne ok do cancel
        // Usar hora do servidor se disponível
        const serverNow = await getServerNowOnce();
        const now = serverNow ?? new Date();
        const start = new Date(appt.start_at);
        const end = new Date(appt.end_at);
        const nowMs = now.getTime();
        const startMs = start.getTime();
        const endMs = end.getTime();
        let patchBody: Record<string, unknown> | null = null;
        if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
            if (nowMs < startMs) {
                // Agora antes do início: mantenha end = start + 1s
                const newEnd = new Date(startMs + 1000);
                patchBody = {
                    status: 'canceled',
                    end_at: newEnd.toISOString(),
                };
            } else if (startMs <= nowMs && nowMs < endMs) {
                // Em andamento: encurte o fim para agora
                const newEnd = new Date(nowMs);
                patchBody = {
                    status: 'canceled',
                    end_at: newEnd.toISOString(),
                };
            } else {
                // Já no passado: garantir status cancelado
                patchBody = { status: 'canceled' };
            }
        } else {
            patchBody = { status: 'canceled' };
        }
        const token = localStorage.getItem('accessToken') || '';
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        Object.assign(headers, buildDeviceHeaders());
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const url = `${API_BASE}/agenda/appointments/${apptId}/`;
        const patchResp = await fetch(url, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(patchBody),
        });
        let patchErrorBody: unknown = null;
        if (!patchResp.ok) {
            try {
                const txt = await patchResp.text();
                try {
                    patchErrorBody = JSON.parse(txt);
                } catch {
                    patchErrorBody = txt;
                }
            } catch {
                /* noop */
            }
        }
        try {
            window.dispatchEvent(
                new CustomEvent('debug:log', {
                    detail: {
                        label: 'cancelWithAdjust: patch sent',
                        data: {
                            ok: patchResp.ok,
                            status: patchResp.status,
                            body: patchBody,
                            error: patchErrorBody,
                        },
                        ts: Date.now(),
                    },
                }),
            );
        } catch {
            /* noop */
        }
        // Fallback strategy: if PATCH 400 with both status + end_at provided, retry with only end_at (some backends reject redundant status update after /cancel/)
        if (
            !patchResp.ok &&
            patchResp.status === 400 &&
            patchBody &&
            'end_at' in patchBody
        ) {
            try {
                const fallbackBody = {
                    end_at: (patchBody as { end_at: string }).end_at,
                };
                const fallbackResp = await fetch(url, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(fallbackBody),
                });
                let fbErr: unknown = null;
                if (!fallbackResp.ok) {
                    try {
                        const t = await fallbackResp.text();
                        try {
                            fbErr = JSON.parse(t);
                        } catch {
                            fbErr = t;
                        }
                    } catch {
                        /* noop */
                    }
                }
                try {
                    window.dispatchEvent(
                        new CustomEvent('debug:log', {
                            detail: {
                                label: 'cancelWithAdjust: fallback patch',
                                data: {
                                    ok: fallbackResp.ok,
                                    status: fallbackResp.status,
                                    body: fallbackBody,
                                    error: fbErr,
                                },
                                ts: Date.now(),
                            },
                        }),
                    );
                } catch {
                    /* noop */
                }
            } catch {
                /* noop fallback */
            }
        }
    } catch {
        // silenciar: o cancel já ocorreu
    }
    return cancelRes;
}

export async function finalizeWithFallback(apptId: number): Promise<boolean> {
    // Best-effort: ensure device session exists before hitting protected endpoints
    try {
        await ensureDeviceSession();
    } catch {
        // continue anyway
    }
    // Helper: fetch appointment details
    async function getAppt() {
        try {
            const token = localStorage.getItem('accessToken') || '';
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const url = `${API_BASE}/agenda/appointments/${apptId}/?ts=${Date.now()}`;
            const r = await fetch(url, { headers, cache: 'no-store' });
            if (!r.ok) return null;
            const d = (await r.json()) as {
                id: number;
                start_at: string;
                end_at: string;
                status: 'scheduled' | 'done' | 'canceled';
            };
            return d;
        } catch {
            return null;
        }
    }

    // Force finalize by adjusting times if needed (e.g., too early)
    async function finalizeForceAdjust(): Promise<boolean> {
        try {
            const appt = await getAppt();
            if (!appt) return false;
            // Only attempt adjustments for scheduled appointments
            if (appt.status !== 'scheduled') return true;
            const token = localStorage.getItem('accessToken') || '';
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            Object.assign(headers, buildDeviceHeaders());
            if (token) headers['Authorization'] = `Bearer ${token}`;
            // Use server-aligned now when available
            const serverNow = await getServerNowOnce();
            const now = serverNow ?? new Date();
            const start = new Date(appt.start_at);
            const end = new Date(appt.end_at);
            const nowMs = now.getTime();
            const startMs = start.getTime();
            const endMs = end.getTime();
            // Build PATCH payload depending on relation between now/start/end
            // Case A: now < start -> move start to now and end to now + 1s
            // Case B: start <= now < end -> set end to now
            // Case C: now >= end -> just mark done
            let body: Record<string, unknown> = { status: 'done' };
            if (!Number.isNaN(startMs) && nowMs < startMs) {
                const newStart = new Date(nowMs);
                const newEnd = new Date(nowMs + 1000); // ensure end > start
                body = {
                    ...body,
                    start_at: newStart.toISOString(),
                    end_at: newEnd.toISOString(),
                };
            } else if (
                !Number.isNaN(startMs) &&
                !Number.isNaN(endMs) &&
                startMs <= nowMs &&
                nowMs < endMs
            ) {
                const newEnd = new Date(nowMs);
                // keep start_at; only shorten end
                body = { ...body, end_at: newEnd.toISOString() };
            } else {
                // now >= end: only status is needed
                body = { status: 'done' };
            }
            const url = `${API_BASE}/agenda/appointments/${apptId}/`;
            const r = await fetch(url, {
                method: 'PATCH',
                headers,
                body: JSON.stringify(body),
            });
            return r.ok;
        } catch {
            return false;
        }
    }

    // Try finalize; if "too early", perform force-adjust
    try {
        const token = localStorage.getItem('accessToken') || '';
        const headers: Record<string, string> = {};
        Object.assign(headers, buildDeviceHeaders(), {
            'X-Client-Now': new Date().toISOString(),
        });
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const url = `${API_BASE}/agenda/appointments/${apptId}/finalize/`;
        let r = await fetch(url, { method: 'POST', headers });
        if (r.status === 401 || r.status === 403) {
            try {
                await ensureDeviceSession(true);
            } catch {
                /* ignore */
            }
            r = await fetch(url, { method: 'POST', headers });
        }
        if (r.ok) return true;
        if (r.status === 422) {
            try {
                const data = await r.json();
                if (data && data.code === 'too_early') {
                    const forced = await finalizeForceAdjust();
                    if (forced) return true;
                }
            } catch {
                /* ignore */
            }
        }
    } catch {
        /* ignore */
    }

    // Try alias endpoint
    try {
        const ok = await postDone(apptId);
        if (ok) return true;
    } catch {
        /* ignore */
    }

    // Final fallback: force-adjust via PATCH; if that fails, last attempt: status only
    if (await finalizeForceAdjust()) return true;
    return await patchStatus(apptId, 'done');
}

export async function fetchFutureAppointments(
    clientId: number,
    startRefISO: string,
    excludeAppointmentId?: number | null,
    limitOverfetch = 20,
): Promise<
    Array<{
        id: number;
        start_at: string;
        end_at: string;
        status: 'scheduled' | 'done' | 'canceled';
        title?: string;
        notes?: string;
    }>
> {
    const token = localStorage.getItem('accessToken') || '';
    if (!token) return [];
    const url = `${API_BASE}/agenda/appointments/?start=${encodeURIComponent(
        startRefISO,
    )}&limit=${limitOverfetch}&ordering=start_at&client=${clientId}`;
    const r = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return [];
    const data = (await r.json()) as unknown;
    const arr = Array.isArray(data) ? data : [];
    const list = arr
        .filter(a => a.status === 'scheduled')
        .filter(a =>
            excludeAppointmentId ? a.id !== excludeAppointmentId : true,
        );
    return list;
}

export async function probeOngoingAroundNow(
    clientId: number,
    windowSeconds = 30,
): Promise<null | { id: number; start_at: string; end_at: string }> {
    try {
        const token = localStorage.getItem('accessToken') || '';
        if (!token) return null;
        const now = new Date();
        const start = new Date(now.getTime() - windowSeconds * 1000);
        const end = new Date(now.getTime() + windowSeconds * 1000);
        const url = `${API_BASE}/agenda/appointments/?client=${clientId}&status=scheduled&start=${encodeURIComponent(
            start.toISOString(),
        )}&end=${encodeURIComponent(end.toISOString())}&ts=${Date.now()}`;
        const r = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
        });
        if (!r.ok) return null;
        const data = (await r.json()) as Array<{
            id: number;
            start_at: string;
            end_at: string;
        }>;
        return Array.isArray(data) && data.length ? data[0] : null;
    } catch {
        return null;
    }
}
