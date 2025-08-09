// frontend\src\pages\Clients\ClientFormPage.tsx

// Página de formulário de cliente para mobile
import React from 'react';
import ClientForm from '../../components/ClientForm';

export default function ClientFormPage() {
    return (
        <div style={{ maxWidth: '900px', padding: '2rem', margin: 'auto' }}>
            <ClientForm />
        </div>
    );
}
