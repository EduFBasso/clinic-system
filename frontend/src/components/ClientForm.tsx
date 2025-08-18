// frontend\src\components\ClientForm.tsx
import { API_BASE } from '../config/api';
import React, { useEffect, useState } from 'react';
import type { ClientData } from '../types/ClientData';
import ClientFormDesktop from './ClientFormDesktop';
import ClientFormMobile from './ClientFormMobile';
import useIsMobile from './useIsMobile';
import { useNavigate } from 'react-router-dom';

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

    const [feedback, setFeedback] = useState<{
        type: 'error' | 'success';
        message: string;
    } | null>(null);
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem('accessToken');
        if (!token) {
            setFeedback({ type: 'error', message: 'Usuário não autenticado.' });
            return;
        }

        // Cadastro (POST)
        if (!cliente?.id) {
            // Garante que email, cpf e phone sejam null se vazios
            const dataToSend = {
                ...formData,
                email: formData.email?.trim() ? formData.email : null,
                cpf: formData.cpf?.trim() ? formData.cpf : null,
                phone: formData.phone?.trim() ? formData.phone : null,
            };
            fetch(`${API_BASE}/register/clients/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(dataToSend),
            })
                .then(async res => {
                    if (!res.ok) {
                        const errorData = await res.json();
                        setFeedback({
                            type: 'error',
                            message:
                                'Erro ao cadastrar cliente: ' +
                                JSON.stringify(errorData),
                        });
                        if (isMobile) {
                            setTimeout(() => setFeedback(null), 3000);
                        }
                        throw new Error('Erro ao cadastrar cliente');
                    }
                    return res.json();
                })
                .then(createdClient => {
                    setFeedback({
                        type: 'success',
                        message: 'Cliente cadastrado com sucesso!',
                    });
                    // Salva o id do novo cliente para seleção automática
                    if (createdClient && createdClient.id) {
                        localStorage.setItem(
                            'newClientId',
                            String(createdClient.id),
                        );
                    }
                    // Redireciona para home em todos os casos
                    setTimeout(
                        () => {
                            window.dispatchEvent(new Event('updateClients'));
                            navigate('/');
                        },
                        isMobile ? 3000 : 1500,
                    );
                })
                .catch(async err => {
                    setFeedback({
                        type: 'error',
                        message: 'Erro ao cadastrar: ' + err.message,
                    });
                    if (isMobile) {
                        setTimeout(() => setFeedback(null), 3000);
                    }
                });
            return;
        }

        // Edição (PATCH)
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
        fetch(`${API_BASE}/register/clients/${cliente.id}/`, {
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
                    setFeedback({
                        type: 'error',
                        message:
                            'Erro ao salvar cliente: ' +
                            JSON.stringify(errorData),
                    });
                    // No mobile, exibe erro por 3s
                    if (isMobile) {
                        setTimeout(() => setFeedback(null), 3000);
                    }
                    throw new Error('Erro ao salvar cliente');
                }
                return res.json();
            })
            .then(() => {
                setFeedback({
                    type: 'success',
                    message: 'Cliente atualizado com sucesso!',
                });
                setTimeout(() => {
                    if (window.opener) {
                        window.opener.dispatchEvent(new Event('updateClients'));
                        window.close();
                    } else {
                        window.dispatchEvent(new Event('updateClients'));
                        if (isMobile) {
                            navigate('/');
                        } else {
                            navigate('/clients');
                        }
                    }
                }, 1500);
            })
            .catch(async err => {
                if (err.response) {
                    const errorData = await err.response.json();
                    setFeedback({
                        type: 'error',
                        message: 'Erro ao salvar: ' + JSON.stringify(errorData),
                    });
                } else {
                    setFeedback({
                        type: 'error',
                        message: 'Erro ao salvar: ' + err.message,
                    });
                }
            });
    };

    const navigate = useNavigate();

    function handleCancel() {
        // Se o formulário está em uma janela separada:
        if (window.opener) {
            window.close();
        } else {
            navigate('/clients');
        }
    }

    function handleDelete() {
        if (window.confirm('Tem certeza que deseja excluir este cliente?')) {
            const token = localStorage.getItem('accessToken');
            if (!token) {
                setFeedback({
                    type: 'error',
                    message: 'Usuário não autenticado.',
                });
                return;
            }

            fetch(`${API_BASE}/register/clients/${cliente?.id}/`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            })
                .then(res => {
                    if (!res.ok) {
                        setFeedback({
                            type: 'error',
                            message: 'Erro ao excluir cliente',
                        });
                        // No mobile, exibe erro por 3s
                        if (isMobile) {
                            setTimeout(() => setFeedback(null), 3000);
                        }
                        throw new Error('Erro ao excluir cliente');
                    }
                    setFeedback({
                        type: 'success',
                        message: 'Cliente excluído com sucesso!',
                    });
                    if (isMobile) {
                        setTimeout(() => {
                            window.dispatchEvent(new Event('updateClients'));
                            navigate('/');
                        }, 1500);
                    } else {
                        setTimeout(() => {
                            window.dispatchEvent(new Event('updateClients'));
                            navigate('/clients');
                        }, 1500);
                    }
                    // Se estiver em popup, fecha
                    if (window.opener) {
                        window.opener.dispatchEvent(new Event('updateClients'));
                        window.close();
                    }
                })
                .catch(err => {
                    setFeedback({
                        type: 'error',
                        message: 'Erro ao excluir cliente: ' + err.message,
                    });
                });
        }
    }

    const isEdit = !!cliente?.id;

    const isMobile = useIsMobile();

    if (isMobile) {
        return (
            <>
                {feedback && (
                    <div
                        style={{
                            color: feedback.type === 'error' ? 'red' : 'green',
                            background: '#f8f8f8',
                            border: `1px solid ${
                                feedback.type === 'error'
                                    ? '#d32f2f'
                                    : '#388e3c'
                            }`,
                            borderRadius: 6,
                            padding: '0.75rem',
                            marginBottom: '1rem',
                            textAlign: 'center',
                            fontWeight: 'bold',
                        }}
                    >
                        {feedback.message}
                    </div>
                )}
                <ClientFormMobile
                    formData={formData}
                    handleChange={handleChange}
                    handleSubmit={handleSubmit}
                    handleCancel={handleCancel}
                    handleDelete={handleDelete}
                    isEdit={isEdit}
                />
            </>
        );
    }
    return (
        <>
            {feedback && (
                <div
                    style={{
                        color: feedback.type === 'error' ? 'red' : 'green',
                        background: '#f8f8f8',
                        border: `1px solid ${
                            feedback.type === 'error' ? '#d32f2f' : '#388e3c'
                        }`,
                        borderRadius: 6,
                        padding: '0.75rem',
                        marginBottom: '1rem',
                        textAlign: 'center',
                        fontWeight: 'bold',
                    }}
                >
                    {feedback.message}
                </div>
            )}
            <ClientFormDesktop
                formData={formData}
                setFormData={setFormData}
                handleChange={handleChange}
                handleSubmit={handleSubmit}
                handleCancel={handleCancel}
                handleDelete={handleDelete}
                isEdit={isEdit}
            />
        </>
    );
}
