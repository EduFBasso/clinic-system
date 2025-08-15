// frontend\src\components\ClientForm.tsx
import React, { useEffect, useState } from 'react';
import type { ClientData } from '../types/ClientData';
import ClientFormDesktop from './ClientFormDesktop';
import ClientFormMobile from './ClientFormMobile';
import useIsMobile from './useIsMobile';

export default function ClientForm({
    cliente,
}: {
    cliente?: Partial<ClientData>;
}) {
    const [formData, setFormData] = useState<ClientData>({
        first_name: cliente?.first_name ?? '',
        last_name: cliente?.last_name ?? '',
        email: cliente?.email ?? '',
        phone: cliente?.phone ?? '',
        cpf: cliente?.cpf ?? '',
        address_street: cliente?.address_street ?? '',
        address_number: cliente?.address_number ?? '',
        city: cliente?.city ?? '',
        state: cliente?.state ?? '',
        postal_code: cliente?.postal_code ?? '',
        sport_activity: cliente?.sport_activity ?? '',
        academic_activity: cliente?.academic_activity ?? '',
        footwear_used: cliente?.footwear_used ?? '',
        sock_used: cliente?.sock_used ?? '',
        takes_medication: cliente?.takes_medication ?? 'Não',
        had_surgery: cliente?.had_surgery ?? 'Não',
        is_pregnant: cliente?.is_pregnant ?? false,
        pain_sensitivity: cliente?.pain_sensitivity ?? '',
        clinical_history: cliente?.clinical_history ?? '',
        plantar_view_left: cliente?.plantar_view_left ?? '',
        plantar_view_right: cliente?.plantar_view_right ?? '',
        dermatological_pathologies_left:
            cliente?.dermatological_pathologies_left ?? '',
        dermatological_pathologies_right:
            cliente?.dermatological_pathologies_right ?? '',
        nail_changes_left: cliente?.nail_changes_left ?? '',
        nail_changes_right: cliente?.nail_changes_right ?? '',
        deformities_left: cliente?.deformities_left ?? '',
        deformities_right: cliente?.deformities_right ?? '',
        sensitivity_test: cliente?.sensitivity_test ?? '',
        other_procedures: cliente?.other_procedures ?? '',
    });

    useEffect(() => {
        if (cliente) {
            setFormData(prev => ({
                ...prev,
                ...cliente,
                takes_medication: cliente.takes_medication ?? 'Não',
                had_surgery: cliente.had_surgery ?? 'Não',
            }));
        }
    }, [cliente]);

    function handleChange(
        fieldOrEvent:
            | keyof ClientData
            | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
        value?: ClientData[keyof ClientData],
    ) {
        if (typeof fieldOrEvent === 'string') {
            setFormData(prev => ({
                ...prev,
                [fieldOrEvent]: value ?? '',
            }));
        } else {
            const { name, value } = fieldOrEvent.target;
            setFormData(prev => ({
                ...prev,
                [name]: value ?? '',
            }));
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!cliente?.id) {
            alert('ID do cliente não encontrado.');
            return;
        }
        const token = localStorage.getItem('accessToken');
        if (!token) {
            alert('Usuário não autenticado.');
            return;
        }
        // Monta o payload apenas com campos alterados
        const payload: Partial<ClientData> = {};
        Object.keys(formData).forEach(key => {
            if (
                cliente &&
                formData[key as keyof ClientData] !==
                    cliente[key as keyof ClientData]
            ) {
                (payload as Partial<Record<string, unknown>>)[key] =
                    formData[key as keyof ClientData];
            }
        });
        // Garante que campos booleanos e string estejam corretos
        if ('is_pregnant' in payload) {
            payload.is_pregnant = !!formData.is_pregnant;
        }
        if ('takes_medication' in payload) {
            payload.takes_medication = formData.takes_medication ?? '';
        }
        if ('had_surgery' in payload) {
            payload.had_surgery = formData.had_surgery ?? '';
        }
        fetch(`http://localhost:8000/register/clients/${cliente.id}/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        })
            .then(async res => {
                if (!res.ok) {
                    const errorData = await res.json();
                    alert(
                        'Erro ao salvar cliente: ' + JSON.stringify(errorData),
                    );
                    throw new Error('Erro ao salvar cliente');
                }
                return res.json();
            })
            .then(data => {
                alert('Cliente atualizado com sucesso!');
                // Aqui pode redirecionar ou atualizar lista
            })
            .catch(async err => {
                if (err.response) {
                    const errorData = await err.response.json();
                    alert('Erro ao salvar: ' + JSON.stringify(errorData));
                } else {
                    alert('Erro ao salvar: ' + err.message);
                }
            });
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
