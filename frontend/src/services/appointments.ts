import { apiFetch, ApiError } from '../utils/apiFetch';
import { getServerNowOnce } from './time';
import ensureDeviceSession from './sessions';

export async function optionsFinalizeSupported(
    apptId: number,
): Promise<boolean> {
    try {
        await apiFetch(`/agenda/appointments/${apptId}/finalize/`, { method: 'OPTIONS' });
        return true;
    } catch {
        return false;
    }
}

export async function postFinalize(apptId: number): Promise<boolean> {
    try {
        await apiFetch(`/agenda/appointments/${apptId}/finalize/`, {
            method: 'POST',
            headers: { 'x-client-now': new Date().toISOString() },
        });
        return true;
    } catch {
        return false;
    }
}

export async function postDone(apptId: number): Promise<boolean> {
    try {
        await apiFetch(`/agenda/appointments/${apptId}/done/`, {
            method: 'POST',
            headers: { 'x-client-now': new Date().toISOString() },
        });
        return true;
    } catch {
        return false;
    }
}

export async function patchStatus(
    apptId: number,
    status: 'pending' | 'done' | 'canceled' | 'scheduled',
): Promise<boolean> {
    try {
        await apiFetch(`/agenda/appointments/${apptId}/`, {
            method: 'PATCH',
            headers: { 'x-client-now': new Date().toISOString() },
            body: { status },
        });
        return true;
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
        try {
            await apiFetch(`/agenda/appointments/${apptId}/cancel/`, {
                method: 'POST',
                cache: 'no-store',
            });
            return { ok: true, status: 200 };
        } catch (e) {
            const err = e as ApiError | Error;
            const status = (err as ApiError).status ?? 0;
            return { ok: false, status, text: err.message };
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
            return await apiFetch(`/agenda/appointments/${apptId}/?ts=${Date.now()}`, {
                cache: 'no-store',
            }) as { id: number; start_at: string; end_at: string; status: 'scheduled' | 'pending' | 'done' | 'canceled' };
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
        let patchOk = false;
        let patchStatus = 0;
        try {
            await apiFetch(`/agenda/appointments/${apptId}/`, {
                method: 'PATCH',
                body: patchBody,
            });
            patchOk = true;
        } catch (e) {
            patchStatus = (e as ApiError).status ?? 0;
        }
        try {
            window.dispatchEvent(
                new CustomEvent('debug:log', {
                    detail: {
                        label: 'cancelWithAdjust: patch sent',
                        data: { ok: patchOk, status: patchStatus, body: patchBody },
                        ts: Date.now(),
                    },
                }),
            );
        } catch { /* noop */ }
        // Fallback: if PATCH 400 with end_at, retry with only end_at
        if (!patchOk && patchStatus === 400 && patchBody && 'end_at' in patchBody) {
            try {
                const fallbackBody = { end_at: (patchBody as { end_at: string }).end_at };
                let fbOk = false;
                let fbStatus = 0;
                try {
                    await apiFetch(`/agenda/appointments/${apptId}/`, {
                        method: 'PATCH',
                        body: fallbackBody,
                    });
                    fbOk = true;
                } catch (e) {
                    fbStatus = (e as ApiError).status ?? 0;
                }
                try {
                    window.dispatchEvent(
                        new CustomEvent('debug:log', {
                            detail: {
                                label: 'cancelWithAdjust: fallback patch',
                                data: { ok: fbOk, status: fbStatus, body: fallbackBody },
                                ts: Date.now(),
                            },
                        }),
                    );
                } catch { /* noop */ }
            } catch { /* noop fallback */ }
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
            return await apiFetch(`/agenda/appointments/${apptId}/?ts=${Date.now()}`, { cache: 'no-store' }) as { id: number; start_at: string; end_at: string; status: 'scheduled' | 'done' | 'canceled' };
        } catch {
            return null;
        }
    }

    // Force finalize by adjusting times if needed (e.g., too early)
    async function finalizeForceAdjust(): Promise<boolean> {
        try {
            const appt = await getAppt();
            if (!appt) return false;
            if (appt.status !== 'scheduled') return true;
            const serverNow = await getServerNowOnce();
            const now = serverNow ?? new Date();
            const nowMs = now.getTime();
            const startMs = new Date(appt.start_at).getTime();
            const endMs = new Date(appt.end_at).getTime();
            let body: Record<string, unknown> = { status: 'pending' };
            if (!Number.isNaN(startMs) && nowMs < startMs) {
                body = { ...body, start_at: new Date(nowMs).toISOString(), end_at: new Date(nowMs + 1000).toISOString() };
            } else if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && startMs <= nowMs && nowMs < endMs) {
                body = { ...body, end_at: new Date(nowMs).toISOString() };
            }
            await apiFetch(`/agenda/appointments/${apptId}/`, { method: 'PATCH', body });
            return true;
        } catch {
            return false;
        }
    }

    // Try finalize; if "too early", perform force-adjust
    try {
        let ok = false;
        let status422 = false;
        let tooEarlyCode = false;
        try {
            await apiFetch(`/agenda/appointments/${apptId}/finalize/`, {
                method: 'POST',
                headers: { 'X-Client-Now': new Date().toISOString() },
            });
            ok = true;
        } catch (e) {
            const err = e as ApiError;
            if (err.status === 422) {
                status422 = true;
                tooEarlyCode = err.code === 'too_early';
            } else if (err.status === 401 || err.status === 403) {
                try { await ensureDeviceSession(true); } catch { /* ignore */ }
                try {
                    await apiFetch(`/agenda/appointments/${apptId}/finalize/`, {
                        method: 'POST',
                        headers: { 'X-Client-Now': new Date().toISOString() },
                    });
                    ok = true;
                } catch { /* ignore retry */ }
            }
        }
        if (ok) return true;
        if (status422 && tooEarlyCode) {
            const forced = await finalizeForceAdjust();
            if (forced) return true;
        }
    } catch { /* ignore */ }

    // Final fallback: force-adjust via PATCH; if that fails, last attempt: status only
    if (await finalizeForceAdjust()) return true;
    return await patchStatus(apptId, 'pending');
}

export async function fetchFutureAppointments(
    clientId: number,
    startRefISO: string,
    excludeAppointmentId?: number | null,
    limitOverfetch = 20,
): Promise<Array<{ id: number; start_at: string; end_at: string; status: 'scheduled' | 'pending' | 'done' | 'canceled'; title?: string; notes?: string; }>> {
    try {
        const data = await apiFetch(
            `/agenda/appointments/?start=${encodeURIComponent(startRefISO)}&limit=${limitOverfetch}&ordering=start_at&client=${clientId}`,
        ) as unknown[];
        const arr = Array.isArray(data) ? data : [];
        return arr
            .filter((a: unknown) => (a as { status: string }).status === 'scheduled')
            .filter((a: unknown) => excludeAppointmentId ? (a as { id: number }).id !== excludeAppointmentId : true) as typeof arr extends Array<infer T> ? T[] : never;
    } catch {
        return [];
    }
}

export async function probeOngoingAroundNow(
    clientId: number,
    windowSeconds = 30,
): Promise<null | { id: number; start_at: string; end_at: string }> {
    try {
        const now = new Date();
        const start = new Date(now.getTime() - windowSeconds * 1000);
        const end = new Date(now.getTime() + windowSeconds * 1000);
        const data = await apiFetch(
            `/agenda/appointments/?client=${clientId}&status=scheduled&start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}&ts=${Date.now()}`,
            { cache: 'no-store' },
        ) as Array<{ id: number; start_at: string; end_at: string }>;
        return Array.isArray(data) && data.length ? data[0] : null;
    } catch {
        return null;
    }
}
