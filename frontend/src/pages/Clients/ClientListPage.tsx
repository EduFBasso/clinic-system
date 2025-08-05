// Página principal de clientes: lista + botão para novo cliente
import React, { useState } from 'react';
import AppModal from '../../components/Modal';
import ClientForm from '../../components/ClientForm';
import useIsMobile from '../hooks/useIsMobile';

export default function ClientListPage() {
    const [modalOpen, setModalOpen] = useState(false);
    const isMobile = useIsMobile();

    const handleAddClient = () => {
        if (isMobile) {
            window.location.href = '/clients/new';
        } else {
            setModalOpen(true);
        }
    };

    return (
        <div>
            <button onClick={handleAddClient}>Novo Cliente</button>
            {/* Lista de clientes será implementada aqui */}
            {!isMobile && (
                <AppModal open={modalOpen} onClose={() => setModalOpen(false)}>
                    <ClientForm />
                </AppModal>
            )}
        </div>
    );
}
