// frontend\src\components\ClientForm.tsx
import { API_BASE } from '../config/api';
import React, { useEffect, useRef, useState } from 'react';
import { normalizeDOBForApi } from '../utils/dateOfBirth';
import type { ClientData } from '../types/ClientData';
import ClientPersonalDataForm from './ClientPersonalDataForm/ClientPersonalDataForm';
import ClientAddressForm from './ClientAddressForm/ClientAddressForm';
import styles from './ClientForm.module.css';
import useUnsavedChangesGuard from '../hooks/useUnsavedChangesGuard';
import { useNavigate } from 'react-router-dom';

export default function ClientForm({
    cliente,
}: {
    cliente?: Partial<ClientData>;
}) {
    // Removido auto-timeout: fluxo agora depende de modal com botão OK
    // Marca erros já tratados para não sobrescrever mensagens específicas em catch
    type HandledError = Error & { handled?: boolean };
    function isHandledError(e: unknown): e is HandledError {
        return typeof e === 'object' && e !== null && 'handled' in e;
    }
    // Converte erros do DRF/DB em mensagens amigáveis
    function parseApiError(errorData: unknown, status?: number): string {
        if (status === 401) return 'Sessão expirada. Faça login novamente.';

        // String direta (ex.: UNIQUE constraint)
        if (typeof errorData === 'string') {
            const s = errorData;
            if (
                /UNIQUE constraint failed|duplicate key value|violates unique constraint|unique|já\s*cadastr/i.test(
                    s,
                )
            ) {
                if (/email/i.test(s)) return 'E-mail já existe.';
                if (
                    /phone|telefone|register_client_phone|phone_digits/i.test(s)
                )
                    return 'Este telefone já cadastrado';
                return 'Registro duplicado: valor já existe.';
            }
            if (/credenciais|credentials|autentica/i.test(s))
                return 'Sessão expirada. Faça login novamente.';
            return s;
        }

        // Objeto de erros do DRF
        if (errorData && typeof errorData === 'object') {
            const obj = errorData as Record<string, unknown>;
            if (typeof obj.detail === 'string') {
                const d = obj.detail;
                if (
                    /UNIQUE constraint failed|duplicate key value|violates unique constraint|unique|já\s*cadastr/i.test(
                        d,
                    )
                ) {
                    if (/email/i.test(d)) return 'E-mail já existe.';
                    if (
                        /phone|telefone|register_client_phone|phone_digits/i.test(
                            d,
                        )
                    )
                        return 'Este telefone já cadastrado';
                    return 'Registro duplicado: valor já existe.';
                }
                if (/credenciais|credentials|autentica/i.test(d))
                    return 'Sessão expirada. Faça login novamente.';
                return d;
            }

            const messages: string[] = [];
            for (const [field, val] of Object.entries(obj)) {
                const label =
                    field === 'email'
                        ? 'E-mail'
                        : field === 'phone'
                          ? 'Telefone'
                          : field === 'state'
                            ? 'Estado'
                            : field === 'city'
                              ? 'Cidade'
                              : field === 'postal_code'
                                ? 'CEP'
                                : field === 'profession'
                                  ? 'Profissão'
                                  : field.replace(/_/g, ' ');
                const toText = (v: unknown) =>
                    Array.isArray(v)
                        ? v.map(x => String(x)).join(', ')
                        : String(v ?? '');
                const txt = toText(val);
                if (
                    /já existe|exists|unique|duplicate|violates unique constraint|já\s*cadastr/i.test(
                        txt,
                    )
                ) {
                    if (field === 'phone' || /phone|telefone/i.test(txt)) {
                        messages.push('Este telefone já cadastrado');
                    } else {
                        messages.push(`${label} já existe.`);
                    }
                } else if (txt) {
                    messages.push(`${label}: ${txt}`);
                }
            }
            if (messages.length) return messages.join(' ');
        }

        return 'Erro ao processar solicitação.';
    }
    const [formData, setFormData] = useState<ClientData>({
        first_name: cliente?.first_name ?? '',
        last_name: cliente?.last_name ?? '',
        email: cliente?.email ?? '',
        phone: cliente?.phone ?? '',
        profession: cliente?.profession ?? '',
        rg: cliente?.rg ?? '',
        document_type: cliente?.document_type ?? '',
        document_number: cliente?.document_number ?? '',
        sex: cliente?.sex ?? '',
        marital_status: cliente?.marital_status ?? '',
        nationality: cliente?.nationality ?? '',
        address: cliente?.address ?? '',
        neighborhood: cliente?.neighborhood ?? '',
        city: cliente?.city ?? 'Limeira',
        state: cliente?.state ?? 'SP',
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

    // Modal de sucesso local removido (uso do SystemMessageModal global)
    // "Salvar e novo" (entrada rápida): quando true, após criar não navega; reseta formulário e foca o primeiro campo
    const quickModeRef = useRef(false);
    const formRef = useRef<HTMLFormElement | null>(null);
    const onQuickSubmit = () => {
        quickModeRef.current = true; // será consumido em handleSubmit
    };

    useEffect(() => {
        if (cliente) {
            setFormData(prev => ({
                ...prev,
                ...cliente,
                takes_medication: cliente.takes_medication ?? 'Não',
                had_surgery: cliente.had_surgery ?? 'Não',
            }));
            // Após hidratar dados vindos do servidor, redefine baseline para evitar dirty falso
            try {
                const snapshot = {
                    ...formData,
                    ...cliente,
                    takes_medication: cliente.takes_medication ?? 'Não',
                    had_surgery: cliente.had_surgery ?? 'Não',
                } as ClientData;
                initialRef.current = JSON.stringify(snapshot);
                setDirty(false);
            } catch {
                /* noop */
            }
        } else {
            // Novo cadastro: baseline = formulário atual (limpo)
            initialRef.current = JSON.stringify(formData);
            setDirty(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cliente?.id]);

    function handleChange(
        fieldOrEvent:
            | keyof ClientData
            | React.ChangeEvent<
                  HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
              >,
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

    // Armazena somente mensagens de erro agora (sucesso usa modal OK)
    const [feedback, setFeedback] = useState<{
        type: 'error';
        message: string;
    } | null>(null);
    // Modal informativo (OK fecha e executa closeSuccessAndExit). Usado para sucesso e alguns erros (ex.: telefone duplicado)
    const [infoModal, setInfoModal] = useState<{
        title: string;
        message: string;
    } | null>(null);
    // Photo file selected in the mobile form (kept out of typed ClientData)
    const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(
        null,
    );
    // Track dirty state: any change vs initial values
    const initialRef = useRef(JSON.stringify(formData));
    const [dirty, setDirty] = useState(false);
    useEffect(() => {
        setDirty(JSON.stringify(formData) !== initialRef.current);
    }, [formData]);
    // Enable guard only when there are unsaved changes
    useUnsavedChangesGuard(dirty, 'Há alterações não salvas. Deseja sair?');
    const uploadPhotoIfNeeded = async (clientId: number, token: string) => {
        if (!selectedPhotoFile) return null;
        const fd = new FormData();
        fd.append('photo', selectedPhotoFile);
        const res = await fetch(`${API_BASE}/register/clients/${clientId}/`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${token}`,
            },
            body: fd,
        });
        if (!res.ok) {
            let errTxt = '';
            try {
                errTxt = await res.text();
            } catch {
                /* noop */
            }
            throw new Error(errTxt || 'Falha ao enviar foto');
        }
        return await res.json();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem('accessToken');
        if (!token) {
            setFeedback({ type: 'error', message: 'Usuário não autenticado.' });
            return;
        }

        // Validação mínima: Nome, Sobrenome e Telefone são obrigatórios
        let first = (formData.first_name || '').trim();
        let last = (formData.last_name || '').trim();
        // Se o usuário digitou nome completo em "Nome" e deixou "Sobrenome" vazio, divide automaticamente
        if (!last && first.includes(' ')) {
            const parts = first.split(/\s+/);
            first = parts.shift() || '';
            last = parts.join(' ');
        }
        const phone = (formData.phone || '').trim();
        if (!first || !last || !phone) {
            setFeedback({
                type: 'error',
                message: 'Nome, Sobrenome e Telefone são obrigatórios.',
            });
            return;
        }

        // Cadastro (POST)
        if (!cliente?.id) {
            // Garante que email, profession e phone sejam normalizados (trim) e null se vazios
            const emailTrim = (formData.email || '').trim();
            const professionTrim = (formData.profession || '').trim();
            const phoneTrim = (formData.phone || '').trim();
            // Normaliza para dígitos, mantendo compatível com backend
            const phoneDigits = phoneTrim.replace(/\D/g, '');
            // Normaliza address_number (somente dígitos ou null)
            const addressNumberDigits = (formData.address_number || '')
                .replace(/\D/g, '')
                .slice(0, 16);
            const address_number = addressNumberDigits || null;
            // Normaliza date_of_birth usando util (aceita dd/mm/YYYY ou ISO)
            const dob = normalizeDOBForApi(formData.date_of_birth || null);
            const dataToSend = {
                ...formData,
                first_name: first,
                last_name: last,
                email: emailTrim ? emailTrim.toLowerCase() : null,
                profession: professionTrim ? professionTrim : null,
                phone: phoneDigits,
                address_number,
                date_of_birth: dob,
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
                        const errorMsg = parseApiError(errorData, res.status);
                        // Se for telefone duplicado, exibe modal que fecha a página
                        if (
                            /telefone|phone/i.test(errorMsg) &&
                            /cadastr|existe|duplicad/i.test(errorMsg)
                        ) {
                            setInfoModal({
                                title: 'Atenção',
                                message: errorMsg,
                            });
                            const err: HandledError = new Error(
                                errorMsg,
                            ) as HandledError;
                            err.handled = true;
                            throw err;
                        }
                        // Demais erros: banner
                        setFeedback({ type: 'error', message: errorMsg });
                        const err: HandledError = new Error(
                            errorMsg,
                        ) as HandledError;
                        err.handled = true;
                        throw err;
                    }
                    return res.json();
                })
                .then(async createdClient => {
                    setInfoModal({
                        title: 'Sucesso',
                        message: 'Cliente cadastrado com sucesso!',
                    });
                    // If a photo was selected, upload it now via multipart PATCH
                    try {
                        if (createdClient?.id) {
                            await uploadPhotoIfNeeded(createdClient.id, token);
                        }
                    } catch (err) {
                        console.warn(
                            'Falha ao enviar foto (não bloqueante):',
                            err,
                        );
                    }
                    // Reset dirty baseline after successful create
                    initialRef.current = JSON.stringify({
                        ...formData,
                        id: createdClient?.id,
                    });
                    setDirty(false);
                    // Clear selected photo after successful create flow
                    setSelectedPhotoFile(null);
                    // Salva o id do novo cliente para seleção automática
                    if (createdClient && createdClient.id) {
                        localStorage.setItem(
                            'newClientId',
                            String(createdClient.id),
                        );
                    }
                    // Atualiza lista e destaca novo cartão
                    try {
                        if (window.opener) {
                            window.opener.dispatchEvent(
                                new Event('updateClients'),
                            );
                            window.opener.focus?.();
                        } else {
                            window.dispatchEvent(new Event('updateClients'));
                        }
                    } catch {
                        /* noop */
                    }

                    // Se for fluxo rápido (Salvar e novo), apenas limpa o formulário e mantém no cadastro
                    if (quickModeRef.current) {
                        quickModeRef.current = false;
                        // Reseta campos para novo cadastro
                        setFormData({
                            first_name: '',
                            last_name: '',
                            email: '',
                            phone: '',
                            profession: '',
                            rg: '',
                            document_type: '',
                            document_number: '',
                            sex: '',
                            marital_status: '',
                            nationality: '',
                            address: '',
                            neighborhood: '',
                            city: 'Limeira',
                            state: 'SP',
                            postal_code: '',
                            sport_activity: '',
                            academic_activity: '',
                            footwear_used: '',
                            sock_used: '',
                            takes_medication: 'Não',
                            had_surgery: 'Não',
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
                        // Foca no primeiro campo (Nome)
                        setTimeout(() => {
                            try {
                                const first = formRef.current?.querySelector(
                                    'input[name="first_name"]',
                                ) as HTMLInputElement | null;
                                first?.focus();
                                first?.select?.();
                            } catch {
                                /* noop */
                            }
                        }, 0);
                        // Reset dirty baseline for the fresh form
                        initialRef.current = JSON.stringify({
                            first_name: '',
                            last_name: '',
                            email: '',
                            phone: '',
                            profession: '',
                            rg: '',
                            document_type: '',
                            document_number: '',
                            sex: '',
                            marital_status: '',
                            nationality: '',
                            address: '',
                            neighborhood: '',
                            city: 'Limeira',
                            state: 'SP',
                            postal_code: '',
                            sport_activity: '',
                            academic_activity: '',
                            footwear_used: '',
                            sock_used: '',
                            takes_medication: 'Não',
                            had_surgery: 'Não',
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
                        setDirty(false);
                        // Mantém na página, sem modal
                        return;
                    }

                    // Fluxo normal: agora exibe modal de sucesso; fechamento só ao clicar OK
                    setInfoModal({
                        title: 'Sucesso',
                        message: 'Cliente cadastrado com sucesso!',
                    });
                })
                .catch(async err => {
                    // Se já tratamos acima, não sobrescreve a mensagem específica
                    if (isHandledError(err) && err.handled) return;
                    setFeedback({
                        type: 'error',
                        message: 'Erro ao cadastrar: ' + (err?.message || ''),
                    });
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
            body.phone = p ? p.replace(/\D/g, '') : null;
        }
        if ('address_number' in payload) {
            const ad = (formData.address_number || '')
                .replace(/\D/g, '')
                .slice(0, 16);
            body.address_number = ad || null;
        }
        if ('date_of_birth' in payload) {
            body.date_of_birth = normalizeDOBForApi(
                formData.date_of_birth || null,
            );
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
                    const errorMsg = parseApiError(errorData, res.status);
                    // Se for telefone duplicado, exibe modal que fecha a página
                    if (
                        /telefone|phone/i.test(errorMsg) &&
                        /cadastr|existe|duplicad/i.test(errorMsg)
                    ) {
                        setInfoModal({ title: 'Atenção', message: errorMsg });
                        const err: HandledError = new Error(
                            errorMsg,
                        ) as HandledError;
                        err.handled = true;
                        throw err;
                    }
                    // Demais erros: banner
                    setFeedback({ type: 'error', message: errorMsg });
                    const err: HandledError = new Error(
                        errorMsg,
                    ) as HandledError;
                    err.handled = true;
                    throw err;
                }
                return res.json();
            })
            .then(async () => {
                setInfoModal({
                    title: 'Sucesso',
                    message: 'Cliente atualizado com sucesso!',
                });
                // If a new photo was selected, upload it now
                try {
                    if (cliente?.id) {
                        await uploadPhotoIfNeeded(cliente.id, token);
                    }
                } catch (err) {
                    console.warn('Falha ao enviar foto (não bloqueante):', err);
                }
                // Reset baseline after successful update
                initialRef.current = JSON.stringify(formData);
                setDirty(false);
                // Clear selected photo after successful update
                setSelectedPhotoFile(null);
                // Dispara mensagem padrão e também persiste para consumo na Home
                // Aguarda interação do usuário no modal de sucesso
            })
            .catch(async err => {
                if (isHandledError(err) && err.handled) return;
                if (
                    typeof err === 'object' &&
                    err !== null &&
                    'response' in err
                ) {
                    const errorData = await (
                        err as unknown as {
                            response: { json: () => Promise<unknown> };
                        }
                    ).response.json();
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

    // Atalho de teclado: Ctrl+Enter / Cmd+Enter para salvar e novo (desktop)
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            const ctrlOrCmd = e.ctrlKey || e.metaKey;
            if (ctrlOrCmd && e.key === 'Enter') {
                onQuickSubmit();
                formRef.current?.requestSubmit?.();
                e.preventDefault();
            }
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, []);

    // Fecha o modal de sucesso e retorna apropriado (fecha popup ou navega), notificando atualização
    const closeSuccessAndExit = () => {
        try {
            if (window.opener) {
                window.opener.dispatchEvent(new Event('updateClients'));
                window.opener.focus?.();
            } else {
                window.dispatchEvent(new Event('updateClients'));
            }
        } catch {
            // noop
        }
        if (window.opener) {
            window.close();
        } else {
            // Home está em '/'
            navigate('/');
        }
    };

    function handleCancel() {
        // Se houver alterações, confirmar.
        if (dirty) {
            const confirmExit = window.confirm(
                'É possível que existam alterações não salvas. Deseja sair mesmo assim?',
            );
            if (!confirmExit) return;
        }
        // Limpa qualquer guard de unload
        try {
            // Remove listener de beforeunload sem usar 'any'
            (
                window as Window & {
                    onbeforeunload: typeof window.onbeforeunload;
                }
            ).onbeforeunload = null;
        } catch {
            /* noop */
        }
        if (window.opener) {
            try {
                window.close();
                return;
            } catch {
                /* noop */
            }
        }
        try {
            (document.activeElement as HTMLElement | null)?.blur?.();
            document.body.classList.remove('keyboardOpen');
        } catch {
            /* noop */
        }
        try {
            window.location.replace('/');
        } catch {
            navigate('/');
        }
    }

    function handleDelete() {
        if (window.confirm('Tem certeza que deseja excluir este cliente?')) {
            // Antes de excluir, remove foco e locks que podem congelar a rolagem no iPhone
            try {
                (document.activeElement as HTMLElement | null)?.blur?.();
                document.body.classList.remove('keyboardOpen');
            } catch {
                /* noop */
            }

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
                        throw new Error('Erro ao excluir cliente');
                    }
                    // Sucesso: sai imediatamente da tela de edição e atualiza a lista
                    try {
                        // Sinaliza para a lista limpar o filtro e não exibir o modal de "nenhum resultado" uma vez
                        localStorage.setItem('postDeleteAction', 'clearFilter');
                    } catch {
                        /* noop: storage indisponível */
                    }

                    // Dispara atualização da lista imediatamente
                    try {
                        if (window.opener) {
                            // Limpa filtro dinâmico e atualiza a lista na tela principal
                            window.opener.dispatchEvent(
                                new Event('clearClients'),
                            );
                            window.opener.dispatchEvent(
                                new Event('updateClients'),
                            );
                        } else {
                            window.dispatchEvent(new Event('updateClients'));
                        }
                    } catch {
                        /* noop: sem suporte a eventos */
                    }

                    // Fecha popup ou navega para a lista sem esperar
                    if (window.opener) {
                        try {
                            window.close();
                        } catch {
                            /* noop: janela já fechada */
                        }
                    } else {
                        // Remove locks e faz reload limpo para evitar travamento pós-exclusão
                        try {
                            document.body.classList.remove('keyboardOpen');
                        } catch {
                            /* noop */
                        }
                        // Garante limpeza do filtro dinâmico imediatamente
                        try {
                            window.dispatchEvent(new Event('clearClients'));
                        } catch {
                            /* noop */
                        }
                        window.location.assign('/');
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

    // Render modal de sucesso quando existir mensagem
    const SuccessModal = infoModal ? (
        <div
            role='dialog'
            aria-modal='true'
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '1rem',
            }}
        >
            <div
                style={{
                    background: '#fff',
                    borderRadius: 8,
                    padding: '1.25rem 1.5rem',
                    maxWidth: 420,
                    width: '100%',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                    fontSize: '1rem',
                }}
            >
                <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.15rem' }}>
                    {infoModal.title}
                </h2>
                <p style={{ margin: '0 0 1.25rem', lineHeight: 1.4 }}>
                    {infoModal.message}
                </p>
                <div style={{ textAlign: 'right' }}>
                    <button
                        type='button'
                        onClick={() => {
                            setInfoModal(null);
                            closeSuccessAndExit();
                        }}
                        style={{
                            background: '#2563eb',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            padding: '0.6rem 1.1rem',
                            cursor: 'pointer',
                            fontWeight: 600,
                        }}
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    return (
        <>
            <form
                ref={formRef}
                onSubmit={handleSubmit}
                noValidate
                data-theme='blue'
            >
                <ClientPersonalDataForm
                    formData={formData}
                    handleChange={handleChange}
                    feedback={feedback}
                />
                <ClientAddressForm
                    formData={formData}
                    handleChange={handleChange}
                />
                <div className={styles.footer}>
                    {!isEdit && (
                        <button
                            type='submit'
                            className={styles.btnSecondary}
                            onClick={() => onQuickSubmit()}
                        >
                            Salvar e novo
                        </button>
                    )}
                    <button type='submit' className={styles.btnPrimary}>
                        Salvar
                    </button>
                    <button
                        type='button'
                        className={styles.btnSecondary}
                        onClick={handleCancel}
                    >
                        Cancelar
                    </button>
                    {isEdit && (
                        <button
                            type='button'
                            className={styles.btnDanger}
                            onClick={handleDelete}
                        >
                            Apagar
                        </button>
                    )}
                </div>
            </form>
            {SuccessModal}
        </>
    );
}
