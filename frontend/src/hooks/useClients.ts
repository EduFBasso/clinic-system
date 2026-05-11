// frontend\src\hooks\useClients.ts
import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../config/api';
import { emit } from '../events/bus';
import { apiFetch } from '../utils/apiFetch';
import { isTokenExpired } from '../utils/jwt';
import type { ClientBasic } from '../types/ClientBasic';

export function useClients() {
    const [clients, setClients] = useState<ClientBasic[]>([]);
    // Inicia como `true` quando há token válido para evitar flash
    // vazio → carregando durante a primeira montagem.
    const [loading, setLoading] = useState<boolean>(() => {
        try {
            const t = localStorage.getItem('accessToken');
            return !!t && !isTokenExpired(t);
        } catch {
            return false;
        }
    });
    const [error, setError] = useState<string | null>(null);
    // Keep a ref for current clients length to decide initial vs background loading
    const clientsRef = useRef<ClientBasic[]>([]);
    const debounceRef = useRef<number | null>(null);
    const lastFetchAtRef = useRef(0);

    useEffect(() => {
        const fetchClients = () => {
            lastFetchAtRef.current = Date.now();
            const token = localStorage.getItem('accessToken');
            if (isTokenExpired(token)) {
                const hadLoggedProfessional = !!localStorage.getItem(
                    'loggedProfessional',
                );
                // Clear immediately so UI shows login instead of a stale logged state
                localStorage.removeItem('accessToken');
                localStorage.removeItem('loggedProfessional');
                setClients([]);
                setLoading(false);
                setError(null);
                if (hadLoggedProfessional) {
                    emit('auth:logout', {
                        reason: 'session_expired',
                    });
                }
                return;
            }
            // Only show the big loading state if we have no data yet (initial load)
            const isInitial = (clientsRef.current?.length || 0) === 0;
            if (isInitial) setLoading(true);
            const url = `${API_BASE}/register/clients-basic/`;
            console.debug('[useClients] API_BASE =', API_BASE, 'fetching', url);
            apiFetch('/register/clients-basic/', {
                timeoutMs: 12000,
            })
                .then(data => {
                    const nextClients = Array.isArray(data)
                        ? (data as ClientBasic[])
                        : [];
                    setClients(nextClients);
                    clientsRef.current = nextClients;
                    setLoading(false); // hide big loading (initial)
                })
                .catch(err => {
                    const rawMessage =
                        err instanceof Error ? err.message : String(err);
                    const isNetworkError =
                        /Failed to fetch|NetworkError|Load failed|Tempo limite/i.test(
                            rawMessage,
                        );
                    const hasCachedClients =
                        (clientsRef.current?.length || 0) > 0;

                    if (hasCachedClients) {
                        // Em refresh em segundo plano, preserva a lista já exibida sem poluir a UI.
                        console.warn(
                            '[useClients] refresh failed, keeping cached clients:',
                            rawMessage,
                        );
                        setLoading(false);
                        return;
                    }

                    setError(
                        isNetworkError
                            ? 'Falha de conexao ao atualizar clientes. Verifique backend/rede.'
                            : rawMessage,
                    );
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
            if (Date.now() - lastFetchAtRef.current < 45_000) {
                return;
            }
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
