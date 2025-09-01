import { useEffect, useState } from 'react';
import { API_BASE } from '../config/api';
import { isTokenExpired } from '../utils/jwt';

export interface Appointment {
    id: number;
    professional: number;
    client: number;
    title: string;
    visit_type: 'avaliacao' | 'retorno' | 'procedimento' | 'outro';
    start_at: string; // ISO
    end_at: string; // ISO
    location?: string;
    notes?: string;
    status: 'scheduled' | 'done' | 'canceled';
}

export function useNextAppointment(clientId?: number) {
    const [data, setData] = useState<Appointment | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!clientId) return;
        const token = localStorage.getItem('accessToken');
        if (isTokenExpired(token)) {
            setData(null);
            setLoading(false);
            setError(null);
            return;
        }
        setLoading(true);
        const url = `${API_BASE}/agenda/appointments/?client=${clientId}&start=${new Date().toISOString()}&status=scheduled`;
        fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => {
                if (r.status === 401) throw new Error('Sessão expirada');
                if (!r.ok) throw new Error('Erro ao buscar agenda');
                return r.json();
            })
            .then(list => {
                // lista já vem ordenada por start_at; pega o primeiro futuro
                setData(Array.isArray(list) && list.length ? list[0] : null);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, [clientId]);

    return { data, loading, error };
}

export function formatDateTime(iso?: string) {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        const dd = d.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
        });
        const hh = d.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
        });
        return `${dd} ${hh}`;
    } catch {
        return iso;
    }
}
