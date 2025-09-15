import { useEffect, useState } from 'react';
import { API_BASE } from '../config/api';
import { isTokenExpired } from '../utils/jwt';

export interface Appointment {
    id: number;
    professional: number;
    client: number;
    title: string;
    visit_type: 'avaliacao' | 'retorno' | 'procedimento' | 'outro' | 'consulta';
    start_at: string; // ISO
    end_at: string; // ISO
    location?: string;
    notes?: string;
    status: 'scheduled' | 'done' | 'canceled';
}

export function useNextAppointment(clientId?: number, enabled: boolean = true) {
    const [data, setData] = useState<Appointment | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!clientId || !enabled) return;
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
    }, [clientId, enabled]);

    return { data, loading, error };
}

// moved to utils/date.ts
