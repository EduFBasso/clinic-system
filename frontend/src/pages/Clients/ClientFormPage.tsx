// frontend\src\pages\Clients\ClientFormPage.tsx

// Página de formulário de cliente para mobile
import React from 'react';
import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import ClientForm from '../../components/ClientForm';
import { API_BASE } from '../../config/api';

export default function ClientFormPage() {
    const { id } = useParams();
    const [cliente, setCliente] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (id) {
            setLoading(true);
            setError('');
            const token = localStorage.getItem('accessToken');
            const url = `${API_BASE}/register/clients/${id}/`;
            console.debug('[ClientFormPage] fetching', url);
            fetch(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            })
                .then(async res => {
                    if (!res.ok) {
                        const errData = await res.json();
                        throw new Error(
                            errData?.message || 'Erro ao buscar cliente',
                        );
                    }
                    return res.json();
                })
                .then(data => {
                    setCliente(data);
                })
                .catch(err => {
                    setError(err.message || 'Erro ao buscar cliente');
                })
                .finally(() => setLoading(false));
        } else {
            // Cadastro novo: limpa cliente
            setCliente(null);
            setLoading(false);
            setError('');
        }
    }, [id]);

    return (
        <div style={{ maxWidth: '900px', padding: '2rem', margin: 'auto' }}>
            {loading && (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <span>Carregando dados do cliente...</span>
                </div>
            )}
            {error && (
                <div
                    style={{
                        color: 'red',
                        textAlign: 'center',
                        padding: '2rem',
                    }}
                >
                    <span>{error}</span>
                </div>
            )}
            {!loading && !error && !id && <ClientForm />}
            {!loading && !error && id && !cliente && (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <div
                        style={{
                            color: 'blue',
                            fontSize: '0.95rem',
                            marginBottom: '1rem',
                            background: '#eef',
                            padding: '0.5rem',
                            borderRadius: '6px',
                        }}
                    >
                        <div>
                            <strong>Debug:</strong>
                        </div>
                        <div>id da rota: {id?.toString()}</div>
                        <div>
                            window.location.pathname:{' '}
                            {typeof window !== 'undefined'
                                ? window.location.pathname
                                : ''}
                        </div>
                        <div>
                            Endpoint usado:{' '}
                            {API_BASE + '/register/clients/' + id + '/'}
                        </div>
                        <div>Token: {localStorage.getItem('accessToken')}</div>
                    </div>
                    <span>Cliente não encontrado.</span>
                </div>
            )}
            {!loading && !error && id && cliente && (
                <ClientForm cliente={cliente} />
            )}
        </div>
    );
}
