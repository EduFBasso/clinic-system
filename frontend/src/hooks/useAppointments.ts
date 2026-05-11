import { useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE } from '../config/api';
import { isTokenExpired } from '../utils/jwt';
import { getAccessToken } from '../utils/auth/session';

export interface Appointment {
    id: number;
    professional: number;
    client: number;
    professional_name?: string;
    client_name?: string;
    title: string;
    visit_type: 'avaliacao' | 'retorno' | 'procedimento' | 'outro' | 'consulta';
    start_at: string;
    end_at: string;
    notes?: string;
    location?: string;
    status: 'scheduled' | 'pending' | 'done' | 'canceled' | 'ongoing';
}

function dayRangeISO(d: Date) {
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { startISO: start.toISOString(), endISO: end.toISOString() };
}

export function useAppointmentsRange(
    startDate: Date,
    endDate: Date,
    clientId?: number,
    reloadKey?: number,
) {
    const [items, setItems] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { startISO, endISO } = useMemo(() => {
        const s = new Date(startDate);
        const e = new Date(endDate);
        return { startISO: s.toISOString(), endISO: e.toISOString() };
    }, [startDate, endDate]);

    // Track last fetched range to distinguish navigation (new range) from
    // background refreshes (same range, reloadKey bumped). Only show the
    // loading indicator on navigation so the UI never flickers on auto-refresh.
    const rangeRef = useRef<{
        startISO: string;
        endISO: string;
        clientId?: number;
    } | null>(null);

    useEffect(() => {
        const token = getAccessToken();
        if (isTokenExpired(token)) {
            setItems([]);
            setLoading(false);
            setError(null);
            return;
        }
        const isNavigation =
            rangeRef.current?.startISO !== startISO ||
            rangeRef.current?.endISO !== endISO ||
            rangeRef.current?.clientId !== clientId;
        if (isNavigation) {
            setLoading(true);
            setItems([]);
        }
        rangeRef.current = { startISO, endISO, clientId };
        const url = `${API_BASE}/agenda/appointments/?start=${encodeURIComponent(
            startISO,
        )}&end=${encodeURIComponent(endISO)}${
            clientId ? `&client=${clientId}` : ''
        }&ts=${Date.now()}`;
        fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
        })
            .then(r => {
                if (!r.ok) throw new Error('Erro ao carregar agenda');
                return r.json();
            })
            .then(data => {
                setItems(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, [startISO, endISO, clientId, reloadKey]);

    return { items, loading, error };
}

export function useAppointments(day: Date, clientId?: number) {
    const { startISO, endISO } = useMemo(() => dayRangeISO(day), [day]);
    const start = useMemo(() => new Date(startISO), [startISO]);
    const end = useMemo(() => new Date(endISO), [endISO]);
    return useAppointmentsRange(start, end, clientId);
}
