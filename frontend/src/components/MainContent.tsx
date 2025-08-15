// frontend\src\components\MainContent.tsx
import React, { useState } from 'react';
import styles from '../styles/components/Main.module.css';
import { useClients } from '../hooks/useClients';
import ClientCard from './ClientCard';
import { useNavigate } from 'react-router-dom';

const MainContent = () => {
    const { clients, loading, error } = useClients();
    const [filter, setFilter] = useState('');

    // Filtra clientes por nome
    const filteredClients = clients.filter(client =>
        `${client.first_name} ${client.last_name}`
            .toLowerCase()
            .includes(filter.toLowerCase()),
    );

    const navigate = useNavigate();

    function handleEdit(cliente: ClientBasic) {
        navigate(`/clients/edit/${cliente.id}`);
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
            {error && <div style={{ color: 'red' }}>{error}</div>}
            <div className={styles.cardsGrid}>
                {filteredClients.map(client => (
                    <ClientCard
                        key={client.id}
                        client={client}
                        onView={() => {}}
                        onEdit={handleEdit}
                    />
                ))}
            </div>
        </main>
    );
};

export default MainContent;
