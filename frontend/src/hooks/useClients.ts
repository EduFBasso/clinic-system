// frontend\src\hooks\useClients.ts
import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../config/api';
import { isTokenExpired } from '../utils/jwt';
import type { ClientBasic } from '../types/ClientBasic';

export function useClients() {
    const [clients, setClients] = useState<ClientBasic[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Keep a ref for current clients length to decide initial vs background loading
    const clientsRef = useRef<ClientBasic[]>([]);
    const debounceRef = useRef<number | null>(null);

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
            // Only show the big loading state if we have no data yet (initial load)
            const isInitial = (clientsRef.current?.length || 0) === 0;
            if (isInitial) setLoading(true);
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
                    clientsRef.current = data;
                    setLoading(false); // hide big loading (initial)
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
            clientsRef.current = [];
        };
        // Handler para atualizar clientes após login
        const scheduleFetch = () => {
            // Debounce multiple update events close together
            if (debounceRef.current) window.clearTimeout(debounceRef.current);
            debounceRef.current = window.setTimeout(() => {
                fetchClients();
                debounceRef.current = null;
            }, 160);
        };
        let lastLog = 0;
        const handleUpdateClients = () => {
            const now = Date.now();
            if (now - lastLog > 500) {
                console.log('Evento updateClients recebido!');
                lastLog = now;
            }
            scheduleFetch();
        };
        // Handler para atualizar clientes ao focar na janela
        const handleFocus = () => {
            scheduleFetch();
        };
        window.addEventListener('clearClients', handleClearClients);
        window.addEventListener('updateClients', handleUpdateClients);
        // Refresh explícito mais forte (ex: após criação e auto-close) – reutiliza mesmo fetch
        window.addEventListener('clients:forceRefresh', handleUpdateClients);
        // Atualiza clientes quando appointments mudam (ex: finalizou/cancelou → pode remover pendência)
        window.addEventListener('appointments:changed', handleUpdateClients);
        window.addEventListener('focus', handleFocus);
        return () => {
            window.removeEventListener('clearClients', handleClearClients);
            window.removeEventListener('updateClients', handleUpdateClients);
            window.removeEventListener(
                'clients:forceRefresh',
                handleUpdateClients,
            );
            window.removeEventListener(
                'appointments:changed',
                handleUpdateClients,
            );
            window.removeEventListener('focus', handleFocus);
            if (debounceRef.current) window.clearTimeout(debounceRef.current);
        };
    }, []);

    return { clients, loading, error, setError };
}
