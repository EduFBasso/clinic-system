// frontend\src\hooks\useClients.ts
import { useEffect, useState } from 'react';

export interface ClientBasic {
    id: number;
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
    address_street?: string;
    address_number?: string;
    city?: string;
    state?: string;
}

export function useClients() {
    const [clients, setClients] = useState<ClientBasic[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchClients = () => {
            const token = localStorage.getItem('accessToken');
            if (!token) {
                setClients([]);
                setLoading(false);
                setError(null);
                return;
            }
            setLoading(true);
            fetch('/register/clients-basic/', {
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
        window.addEventListener('focus', handleFocus);
        return () => {
            window.removeEventListener('clearClients', handleClearClients);
            window.removeEventListener('updateClients', handleUpdateClients);
            window.removeEventListener('focus', handleFocus);
        };
    }, []);

    return { clients, loading, error, setError };
}
