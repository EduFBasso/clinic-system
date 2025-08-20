// frontend\src\components\MainContent.tsx
import { API_BASE } from '../config/api';
import React, { useState } from 'react';
import styles from '../styles/components/Main.module.css';
import { useClients } from '../hooks/useClients';
import ClientCard from './ClientCard';
import type { ClientBasic } from '../types/ClientBasic';
import AppModal from './Modal';
import ClientView from './ClientView';
import type { ClientData } from '../types/ClientData';
import SessionExpiredModal from './SessionExpiredModal';

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
    const { clients, loading, error, setError } = useClients();
    const [filter, setFilter] = useState('');
    const [selectedClient, setSelectedClient] = useState<ClientData | null>(
        null,
    );
    const [modalOpen, setModalOpen] = useState(false);
    const cardRefs = React.useRef<{ [key: number]: HTMLDivElement | null }>({});

    // Seleciona automaticamente o novo cliente cadastrado assim que aparecer na lista
    React.useEffect(() => {
        const newClientId = localStorage.getItem('newClientId');
        if (newClientId && clients.some(c => c.id === Number(newClientId))) {
            setSelectedClientId(Number(newClientId));
            localStorage.removeItem('newClientId');
        }
    }, [clients, setSelectedClientId]);

    // Scroll para o cartão do cliente selecionado
    React.useEffect(() => {
        if (selectedClientId && cardRefs.current[selectedClientId]) {
            cardRefs.current[selectedClientId]?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }
    }, [selectedClientId]);

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
                <SessionExpiredModal
                    open={true}
                    onClose={() => {
                        setError(null);
                        localStorage.removeItem('accessToken');
                        localStorage.removeItem('loggedProfessional');
                        window.dispatchEvent(new Event('clearClients'));
                        window.location.reload();
                    }}
                    message='Sua sessão expirou ou você não está autenticado. Por favor, faça login para acessar os clientes.'
                    color='var(--color-error-light)'
                />
            )}
            {error && !error.includes('Sessão expirada') && (
                <div style={{ color: 'red' }}>{error}</div>
            )}
            <div
                className={styles.cardsGrid}
                style={{ display: 'grid', gap: '20px' }}
            >
                {filteredClients.map(client => (
                    <div
                        key={client.id}
                        ref={el => {
                            cardRefs.current[client.id] = el;
                        }}
                    >
                        <ClientCard
                            client={client}
                            selected={selectedClientId === client.id}
                            onSelect={() => setSelectedClientId(client.id)}
                            onView={handleView}
                            onEdit={handleEdit}
                        />
                    </div>
                ))}
            </div>
            <AppModal open={modalOpen} onClose={handleCloseModal}>
                {selectedClient && <ClientView client={selectedClient} />}
            </AppModal>
        </main>
    );
};

export default MainContent;
