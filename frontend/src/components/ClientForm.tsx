// frontend\src\components\ClientForm.tsx
import { API_BASE } from '../config/api';
import React, { useEffect, useState } from 'react';
import type { ClientData } from '../types/ClientData';
import AppModal from './Modal';
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
        profession: cliente?.profession ?? '',
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

    const [showSuccessModal, setShowSuccessModal] = useState(false);

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

        // Validação mínima: Nome e Sobrenome são obrigatórios
        let first = (formData.first_name || '').trim();
        let last = (formData.last_name || '').trim();
        // Se o usuário digitou nome completo em "Nome" e deixou "Sobrenome" vazio, divide automaticamente
        if (!last && first.includes(' ')) {
            const parts = first.split(/\s+/);
            first = parts.shift() || '';
            last = parts.join(' ');
        }
        if (!first || !last) {
            setFeedback({
                type: 'error',
                message: 'Nome e Sobrenome são obrigatórios.',
            });
            return;
        }

        // Cadastro (POST)
        if (!cliente?.id) {
            // Garante que email, profession e phone sejam normalizados (trim) e null se vazios
            const emailTrim = (formData.email || '').trim();
            const professionTrim = (formData.profession || '').trim();
            const phoneTrim = (formData.phone || '').trim();
            const dataToSend = {
                ...formData,
                first_name: first,
                last_name: last,
                email: emailTrim ? emailTrim.toLowerCase() : null,
                profession: professionTrim ? professionTrim : null,
                phone: phoneTrim ? phoneTrim : null,
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
                        // Tenta obter detalhes do erro para log/feedback
                        let errorData: unknown = null;
                        try {
                            errorData = await res.json();
                        } catch {
                            try {
                                errorData = await res.text();
                            } catch {
                                errorData = null;
                            }
                        }
                        console.error('[ClientForm] create error', {
                            status: res.status,
                            error: errorData,
                            payload: dataToSend,
                        });
                        const errorMsg =
                            typeof errorData === 'string'
                                ? errorData
                                : JSON.stringify(errorData);
                        setFeedback({
                            type: 'error',
                            message: 'Erro ao cadastrar cliente: ' + errorMsg,
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
                    setShowSuccessModal(true);
                    window.dispatchEvent(new Event('updateClients'));
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

        // Constrói o corpo com normalizações sem violar os tipos de payload
        const body: Record<string, unknown> = { ...payload };
        if ('first_name' in payload) {
            body.first_name = (formData.first_name || '').trim();
        }
        if ('last_name' in payload) {
            body.last_name = (formData.last_name || '').trim();
        }
        if ('email' in payload) {
            const e = (formData.email || '').trim();
            body.email = e ? e.toLowerCase() : null;
        }
        if ('profession' in payload) {
            const p = (formData.profession || '').trim();
            body.profession = p ? p : null;
        }
        if ('phone' in payload) {
            const p = (formData.phone || '').trim();
            body.phone = p ? p : null;
        }

        fetch(`${API_BASE}/register/clients/${cliente.id}/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
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
                        // Não existe rota '/clients'; a home está em '/'
                        navigate('/');
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
            // Não existe rota '/clients'; a home está em '/'
            navigate('/');
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
                            // Não existe rota '/clients'; a home está em '/'
                            navigate('/');
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
                {/* Modal de sucesso após cadastro */}
                {showSuccessModal && (
                    <AppModal open={true} onClose={() => {}}>
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <h2 style={{ color: '#388e3c' }}>
                                Cliente cadastrado com sucesso!
                            </h2>
                            <button
                                style={{
                                    marginTop: '2rem',
                                    padding: '0.7rem 2.5rem',
                                    fontSize: '1.1rem',
                                    background: '#388e3c',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                }}
                                onClick={() => {
                                    setShowSuccessModal(false);
                                    window.dispatchEvent(
                                        new Event('updateClients'),
                                    );
                                    if (window.opener) {
                                        window.close();
                                    } else {
                                        navigate('/');
                                    }
                                }}
                            >
                                OK
                            </button>
                        </div>
                    </AppModal>
                )}
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
            {/* Modal de sucesso após cadastro */}
            {showSuccessModal && (
                <AppModal open={true} onClose={() => {}}>
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <h2 style={{ color: '#388e3c' }}>
                            Cliente cadastrado com sucesso!
                        </h2>
                        <button
                            style={{
                                marginTop: '2rem',
                                padding: '0.7rem 2.5rem',
                                fontSize: '1.1rem',
                                background: '#388e3c',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                            }}
                            onClick={() => {
                                setShowSuccessModal(false);
                                if (window.opener) {
                                    window.close();
                                } else {
                                    navigate('/');
                                }
                            }}
                        >
                            OK
                        </button>
                    </div>
                </AppModal>
            )}
        </>
    );
}
