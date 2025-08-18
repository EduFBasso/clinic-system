// frontend\src\components\MainContent.tsx
import { API_BASE } from '../config/api';
import React, { useState } from 'react';
import styles from '../styles/components/Main.module.css';
import { useClients } from '../hooks/useClients';
import ClientCard from './ClientCard';
import type { ClientBasic } from '../types/ClientBasic';
import AppModal from './Modal';
import SuccessMessageBanner from './SuccessMessageBanner';
import ClientView from './ClientView';
import type { ClientData } from '../types/ClientData';

interface MainContentProps {
    selectedClientId: number | null;
    setSelectedClientId: (id: number | null) => void;
    // ...outros props se necessário...
}

const MainContent: React.FC<MainContentProps> = ({
    selectedClientId,
    setSelectedClientId,
    // ...outros props...
}) => {
    const { clients, loading, error } = useClients();
    const [filter, setFilter] = useState('');
    const [selectedClient, setSelectedClient] = useState<ClientData | null>(
        null,
    );
    const [modalOpen, setModalOpen] = useState(false);

    // Seleciona automaticamente o novo cliente cadastrado assim que aparecer na lista
    React.useEffect(() => {
        const newClientId = localStorage.getItem('newClientId');
        if (newClientId && clients.some(c => c.id === Number(newClientId))) {
            setSelectedClientId(Number(newClientId));
            localStorage.removeItem('newClientId');
        }
    }, [clients, setSelectedClientId]);

    // Filtra clientes por nome
    const filteredClients = clients.filter(client =>
        `${client.first_name} ${client.last_name}`
            .toLowerCase()
            .includes(filter.toLowerCase()),
    );

    function handleEdit(cliente: ClientBasic) {
        window.open(
            `/clients/edit/${cliente.id}`,
            '_blank',
            'width=900,height=700,toolbar=no,menubar=no,location=no',
        );
    }

    function handleView(cliente: ClientBasic) {
        fetch(`${API_BASE}/register/clients/${cliente.id}/`, {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            },
        })
            .then(res => res.json())
            .then((data: ClientData) => {
                setSelectedClient(data);
                setModalOpen(true);
            })
            .catch(() => {
                alert('Erro ao buscar dados completos do cliente');
            });
    }

    function handleCloseModal() {
        setModalOpen(false);
        setSelectedClient(null);
    }

    return (
        <main className={styles.main}>
            <SuccessMessageBanner setSelectedClientId={setSelectedClientId} />
            <div className={styles.filterRow}>
                <label htmlFor='client-filter' className={styles.filterLabel}>
                    Filtrar Cliente:
                </label>
                <input
                    id='client-filter'
                    type='text'
                    className={styles.filterInput}
                    placeholder='Digite o nome do cliente...'
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                />
            </div>
            {loading && <div>Carregando clientes...</div>}
            {error && error.includes('Sessão expirada') && (
                <AppModal open={true} onClose={() => setModalOpen(false)}>
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <h2 style={{ color: 'red' }}>Fazer login</h2>
                        <p>
                            Sua sessão expirou ou você não está autenticado.
                            <br />
                            Por favor, faça login para acessar os clientes.
                        </p>
                        <button
                            onClick={() => setModalOpen(false)}
                            style={{
                                marginTop: '1rem',
                                padding: '0.5rem 1.5rem',
                                fontSize: '1.1rem',
                                background: 'var(--color-primary)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                            }}
                        >
                            Fechar
                        </button>
                    </div>
                </AppModal>
            )}
            {error && !error.includes('Sessão expirada') && (
                <div style={{ color: 'red' }}>{error}</div>
            )}
            <div
                className={styles.cardsGrid}
                style={{ display: 'grid', gap: '20px' }}
            >
                {filteredClients.length === 0 && !loading && !error ? (
                    <div
                        style={{
                            textAlign: 'center',
                            color: '#1976d2',
                            fontWeight: 'bold',
                            padding: '2rem',
                        }}
                    >
                        Nenhum cliente cadastrado ainda.
                        <br />
                        Clique em "Novo" para adicionar o primeiro cliente.
                    </div>
                ) : (
                    filteredClients.map(client => (
                        <ClientCard
                            key={client.id}
                            client={client}
                            selected={selectedClientId === client.id}
                            onSelect={() => setSelectedClientId(client.id)}
                            onView={handleView}
                            onEdit={handleEdit}
                        />
                    ))
                )}
            </div>
            <AppModal open={modalOpen} onClose={handleCloseModal}>
                {selectedClient && <ClientView client={selectedClient} />}
            </AppModal>
        </main>
    );
};

export default MainContent;
