import React from 'react';
import { API_BASE } from '../config/api';

export interface FinalizeAudit {
    id: number;
    appointment_id: number;
    professional_id: number;
    client_id: number;
    device_id?: string | null;
    device_info?: string | null;
    client_now?: string | null;
    server_now?: string | null;
    drift_ms?: number | null;
    adjusted_times?: boolean;
    reason?: string | null;
    created_at: string;
}

interface UseFinalizeAuditsArgs {
    open?: boolean;
    appointmentId?: number;
    deviceId?: string;
    start?: Date;
    end?: Date;
}

export function useFinalizeAudits({
    open = false,
    appointmentId,
    deviceId,
    start,
    end,
}: UseFinalizeAuditsArgs) {
    const [audits, setAudits] = React.useState<FinalizeAudit[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const refresh = React.useCallback(async () => {
        if (!open) return;
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('accessToken') || '';
            if (!token) {
                setAudits([]);
                setLoading(false);
                return;
            }
            const params = new URLSearchParams();
            if (appointmentId) params.set('appointment', String(appointmentId));
            if (deviceId) params.set('device_id', deviceId);
            if (start) params.set('start', start.toISOString());
            if (end) params.set('end', end.toISOString());
            const url = `${API_BASE}/agenda/finalize-audits/?${params.toString()}`;
            const r = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store',
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const data = (await r.json()) as FinalizeAudit[];
            setAudits(Array.isArray(data) ? data : []);
        } catch (e) {
            const msg =
                e instanceof Error ? e.message : 'Falha ao listar auditorias';
            setError(msg);
            setAudits([]);
        } finally {
            setLoading(false);
        }
    }, [open, appointmentId, deviceId, start, end]);

    React.useEffect(() => {
        if (!open) return;
        refresh();
        // refresh when reopened
    }, [open, refresh]);

    return { audits, loading, error, refresh } as const;
}
