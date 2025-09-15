// frontend\src\hooks\useClients.ts
import { useEffect, useState } from 'react';
import { API_BASE } from '../config/api';
import { isTokenExpired } from '../utils/jwt';

export interface ClientBasic {
    id: number;
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
    address?: string;
    address_number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    date_of_birth?: string | null;
    next_appointment_start_at?: string | null; // Added for next appointment details
    next_appointment_title?: string | null; // Added for next appointment details
    next_appointment_visit_type?:
        | 'avaliacao'
        | 'retorno'
        | 'procedimento'
        | 'outro'
        | 'consulta'
        | null; // Added for next appointment details
    next_appointment_notes?: string | null; // Added for next appointment notes
    next_appointment_status?: 'scheduled' | 'done' | 'canceled' | null; // Added for next appointment status
    last_appointment_start_at?: string | null;
    last_appointment_title?: string | null;
    last_appointment_notes?: string | null;
    last_appointment_status?: 'scheduled' | 'done' | 'canceled' | null;
}

export function useClients() {
    const [clients, setClients] = useState<ClientBasic[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchClients = () => {
            const token = localStorage.getItem('accessToken');
            if (isTokenExpired(token)) {
                // Clear immediately so UI shows login instead of a stale logged state
                localStorage.removeItem('accessToken');
                localStorage.removeItem('loggedProfessional');
                setClients([]);
                setLoading(false);
                setError(null);
                return;
            }
            setLoading(true);
            const url = `${API_BASE}/register/clients-basic/`;
            console.debug('[useClients] API_BASE =', API_BASE, 'fetching', url);
            fetch(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            })
                .then(res => {
                    if (res.status === 401)
                        throw new Error(
                            'Sessão expirada. É necessário fazer login novamente.',
                        );
                    if (!res.ok) throw new Error('Erro ao buscar clientes');
                    return res.json();
                })
                .then(data => {
                    setClients(data);
                    setLoading(false);
                })
                .catch(err => {
                    setError(err.message);
                    setLoading(false);
                });
        };
        fetchClients();
        // Handler para limpar clientes ao logout
        const handleClearClients = () => {
            setClients([]);
        };
        // Handler para atualizar clientes após login
        const handleUpdateClients = () => {
            console.log('Evento updateClients recebido!');
            fetchClients();
        };
        // Handler para atualizar clientes ao focar na janela
        const handleFocus = () => {
            fetchClients();
        };
        window.addEventListener('clearClients', handleClearClients);
        window.addEventListener('updateClients', handleUpdateClients);
        // Refresh explícito mais forte (ex: após criação e auto-close) – reutiliza mesmo fetch
        window.addEventListener('clients:forceRefresh', handleUpdateClients);
        window.addEventListener('focus', handleFocus);
        return () => {
            window.removeEventListener('clearClients', handleClearClients);
            window.removeEventListener('updateClients', handleUpdateClients);
            window.removeEventListener(
                'clients:forceRefresh',
                handleUpdateClients,
            );
            window.removeEventListener('focus', handleFocus);
        };
    }, []);

    return { clients, loading, error, setError };
}
