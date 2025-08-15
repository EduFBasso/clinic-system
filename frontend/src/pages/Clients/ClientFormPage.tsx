// frontend\src\pages\Clients\ClientFormPage.tsx

// Página de formulário de cliente para mobile
import React from 'react';
import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import ClientForm from '../../components/ClientForm';

export default function ClientFormPage() {
    const { id } = useParams();
    const [cliente, setCliente] = useState(null);

    useEffect(() => {
        if (id) {
            const token = localStorage.getItem('accessToken');
            fetch(`/register/clients/${id}/`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            })
                .then(res => res.json())
                .then(data => setCliente(data));
        }
    }, [id]);

    return (
        <div style={{ maxWidth: '900px', padding: '2rem', margin: 'auto' }}>
            <ClientForm cliente={cliente} />
        </div>
    );
}
