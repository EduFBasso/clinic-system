// frontend\src\components\ClientForm.tsx
import React, { useState } from 'react';
import type { ClientData } from '../types/ClientData';
import ClientFormDesktop from './ClientFormDesktop';
import ClientFormMobile from './ClientFormMobile';
import useIsMobile from './useIsMobile';

export default function ClientForm() {
    const [formData, setFormData] = useState<ClientData>({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        cpf: '',
        address_street: '',
        address_number: '',
        city: '',
        state: '',
        postal_code: '',
        sport_activity: '',
        academic_activity: '',
        footwear_used: '',
        sock_used: '',
        takes_medication: '',
        had_surgery: '',
        is_pregnant: false,
        pain_sensitivity: '',
        clinical_history: '',
        plantar_view_left: '',
        plantar_view_right: '',
        dermatological_pathologies_left: '',
        dermatological_pathologies_right: '',
        nail_changes_left: '',
        nail_changes_right: '',
        deformities_left: '',
        deformities_right: '',
        sensitivity_test: '',
        other_procedures: '',
    });

    function handleChange(
        fieldOrEvent:
            | keyof ClientData
            | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
        value?: ClientData[keyof ClientData],
    ) {
        if (typeof fieldOrEvent === 'string') {
            setFormData(prev => ({
                ...prev,
                [fieldOrEvent]: value,
            }));
        } else {
            const { name, value } = fieldOrEvent.target;
            setFormData(prev => ({
                ...prev,
                [name]: value,
            }));
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Cliente salvo:', formData);
        // Aqui entra a chamada à API futuramente
    };

    const isMobile = useIsMobile();

    if (isMobile) {
        return (
            <ClientFormMobile
                formData={formData}
                handleChange={handleChange}
                handleSubmit={handleSubmit}
            />
        );
    }
    return (
        <ClientFormDesktop
            formData={formData}
            setFormData={setFormData}
            handleChange={handleChange}
            handleSubmit={handleSubmit}
        />
    );
}
