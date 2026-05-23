// frontend\src\components\ClientForm.tsx
import { API_BASE } from '../../config/api';
import React, { useEffect, useRef, useState } from 'react';
import { normalizeDOBForApi } from '../../utils/dateOfBirth';
import type { ClientData } from '../../types/ClientData';
import ClientPersonalDataForm from '../ClientPersonalDataForm/ClientPersonalDataForm';
import ClientAddressForm from '../ClientAddressForm/ClientAddressForm';
import ClientAnamnesisForm from '../ClientAnamnesisForm/ClientAnamnesisForm';
import styles from '../ClientForm.module.css';
import useUnsavedChangesGuard from '../../hooks/useUnsavedChangesGuard';
import { useClientAnamnesis } from '../../hooks/useClientAnamnesis';
import { useClientDelete } from '../../hooks/useClientDelete';
import { parseApiError } from '../../utils/parseApiError';
import InfoModal from '../shared/InfoModal';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { getAccessToken } from '../../utils/auth/session';

export function ClientForm({
    cliente,
}: {
    cliente?: Partial<ClientData>;
}) {
    const { theme } = useTheme();
    const navigate = useNavigate();

    // ── HandledError helper ──────────────────────────────────────────────────
    type HandledError = Error & { handled?: boolean };
    function isHandledError(e: unknown): e is HandledError {
        return typeof e === 'object' && e !== null && 'handled' in e;
    }

    // ── Form state ───────────────────────────────────────────────────────────
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
        dermatological_pathologies_left: cliente?.dermatological_pathologies_left ?? '',
        dermatological_pathologies_right: cliente?.dermatological_pathologies_right ?? '',
        nail_changes_left: cliente?.nail_changes_left ?? '',
        nail_changes_right: cliente?.nail_changes_right ?? '',
        deformities_left: cliente?.deformities_left ?? '',
        deformities_right: cliente?.deformities_right ?? '',
        sensitivity_test: cliente?.sensitivity_test ?? '',
        other_procedures: cliente?.other_procedures ?? '',
    });

    const EMPTY_FORM: ClientData = {
        first_name: '', last_name: '', email: '', phone: '', profession: '',
        rg: '', document_type: '', document_number: '', sex: '',
        marital_status: '', nationality: '', address: '', neighborhood: '',
        city: 'Limeira', state: 'SP', postal_code: '', sport_activity: '',
        academic_activity: '', footwear_used: '', sock_used: '',
        takes_medication: 'Não', had_surgery: 'Não', is_pregnant: false,
        pain_sensitivity: '', clinical_history: '', plantar_view_left: '',
        plantar_view_right: '', dermatological_pathologies_left: '',
        dermatological_pathologies_right: '', nail_changes_left: '',
        nail_changes_right: '', deformities_left: '', deformities_right: '',
        sensitivity_test: '', other_procedures: '',
    };

    const quickModeRef = useRef(false);
    const formRef = useRef<HTMLFormElement | null>(null);
    const onQuickSubmit = () => { quickModeRef.current = true; };

    // ── Dirty tracking ───────────────────────────────────────────────────────
    const initialRef = useRef(JSON.stringify(formData));
    const [dirty, setDirty] = useState(false);
    useEffect(() => {
        setDirty(JSON.stringify(formData) !== initialRef.current);
    }, [formData]);
    useUnsavedChangesGuard(dirty, 'Há alterações não salvas. Deseja sair?');

    // ── Sync when cliente prop changes (edit mode) ───────────────────────────
    useEffect(() => {
        if (cliente) {
            const snapshot = {
                ...formData,
                ...cliente,
                takes_medication: cliente.takes_medication ?? 'Não',
                had_surgery: cliente.had_surgery ?? 'Não',
            } as ClientData;
            setFormData(snapshot);
            try {
                initialRef.current = JSON.stringify(snapshot);
                setDirty(false);
            } catch { /* noop */ }
        } else {
            initialRef.current = JSON.stringify(formData);
            setDirty(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cliente?.id]);

    // ── Feedback / modals ────────────────────────────────────────────────────
    const [feedback, setFeedback] = useState<{ type: 'error'; message: string } | null>(null);
    const [infoModal, setInfoModal] = useState<{ title: string; message: string } | null>(null);
    // ── Sub-hooks ────────────────────────────────────────────────────────────
    const {
        anamnesisFields,
        anamnesisValues,
        setAnamnesisValues,
        handleAnamnesisChange,
        saveAnamnesis,
    } = useClientAnamnesis(cliente?.id);

    const { deleteModalOpen, handleDelete, confirmDelete, cancelDelete } =
        useClientDelete({ cliente, setFeedback });

    // ── handleChange ─────────────────────────────────────────────────────────
    function handleChange(
        fieldOrEvent:
            | keyof ClientData
            | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
        value?: ClientData[keyof ClientData],
    ) {
        if (typeof fieldOrEvent === 'string') {
            setFormData(prev => ({ ...prev, [fieldOrEvent]: value ?? '' }));
        } else {
            const { name, value } = fieldOrEvent.target;
            setFormData(prev => ({ ...prev, [name]: value ?? '' }));
        }
    }

    // ── Navigation helpers ───────────────────────────────────────────────────
    const closeSuccessAndExit = () => {
        try {
            if (window.opener) {
                window.opener.dispatchEvent(new Event('updateClients'));
                window.opener.focus?.();
            } else {
                window.dispatchEvent(new Event('updateClients'));
            }
        } catch { /* noop */ }
        if (window.opener) { window.close(); }
        else { navigate('/'); }
    };

    function handleCancel() {
        if (dirty) {
            const confirmExit = window.confirm('É possível que existam alterações não salvas. Deseja sair mesmo assim?');
            if (!confirmExit) return;
        }
        try {
            (window as Window & { onbeforeunload: typeof window.onbeforeunload }).onbeforeunload = null;
        } catch { /* noop */ }
        if (window.opener) {
            try { window.close(); return; } catch { /* noop */ }
        }
        try {
            (document.activeElement as HTMLElement | null)?.blur?.();
            document.body.classList.remove('keyboardOpen');
        } catch { /* noop */ }
        navigate('/');
    }

    // ── Ctrl+Enter shortcut ──────────────────────────────────────────────────
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                onQuickSubmit();
                formRef.current?.requestSubmit?.();
                e.preventDefault();
            }
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, []);

    // ── handleSubmit ─────────────────────────────────────────────────────────
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const token = getAccessToken();
        if (!token) {
            setFeedback({ type: 'error', message: 'Usuário não autenticado.' });
            return;
        }

        let first = (formData.first_name || '').trim();
        let last = (formData.last_name || '').trim();
        if (!last && first.includes(' ')) {
            const parts = first.split(/\s+/);
            first = parts.shift() || '';
            last = parts.join(' ');
        }
        const phone = (formData.phone || '').trim();
        if (!first || !last || !phone) {
            setFeedback({ type: 'error', message: 'Nome, Sobrenome e Telefone são obrigatórios.' });
            return;
        }

        // ── CREATE (POST) ────────────────────────────────────────────────────
        if (!cliente?.id) {
            const emailTrim = (formData.email || '').trim();
            const professionTrim = (formData.profession || '').trim();
            const phoneDigits = phone.replace(/\D/g, '');
            const addressNumberDigits = (formData.address_number || '').replace(/\D/g, '').slice(0, 16);
            const dataToSend = {
                ...formData,
                first_name: first,
                last_name: last,
                email: emailTrim ? emailTrim.toLowerCase() : null,
                profession: professionTrim || null,
                phone: phoneDigits,
                address_number: addressNumberDigits || null,
                date_of_birth: normalizeDOBForApi(formData.date_of_birth || null),
            };

            fetch(`${API_BASE}/register/clients/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(dataToSend),
            })
                .then(async res => {
                    if (!res.ok) {
                        let errorData: unknown = null;
                        try { errorData = await res.json(); } catch {
                            try { errorData = await res.text(); } catch { errorData = null; }
                        }
                        const errorMsg = parseApiError(errorData, res.status);
                        if (/telefone|phone/i.test(errorMsg) && /cadastr|existe|duplicad/i.test(errorMsg)) {
                            setInfoModal({ title: 'Atenção', message: errorMsg });
                            const err = new Error(errorMsg) as HandledError;
                            err.handled = true;
                            throw err;
                        }
                        setFeedback({ type: 'error', message: errorMsg });
                        const err = new Error(errorMsg) as HandledError;
                        err.handled = true;
                        throw err;
                    }
                    return res.json();
                })
                .then(async createdClient => {
                    try { if (createdClient?.id) await saveAnamnesis(createdClient.id, token); }
                    catch (err) { console.warn('Falha ao salvar anamnese (não bloqueante):', err); }

                    initialRef.current = JSON.stringify({ ...formData, id: createdClient?.id });
                    setDirty(false);
                    if (createdClient?.id) localStorage.setItem('newClientId', String(createdClient.id));

                    try {
                        if (window.opener) { window.opener.dispatchEvent(new Event('updateClients')); window.opener.focus?.(); }
                        else { window.dispatchEvent(new Event('updateClients')); }
                    } catch { /* noop */ }

                    if (quickModeRef.current) {
                        quickModeRef.current = false;
                        setFormData(EMPTY_FORM);
                        setAnamnesisValues({});
                        initialRef.current = JSON.stringify(EMPTY_FORM);
                        setDirty(false);
                        setTimeout(() => {
                            try {
                                const el = formRef.current?.querySelector('input[name="first_name"]') as HTMLInputElement | null;
                                el?.focus(); el?.select?.();
                            } catch { /* noop */ }
                        }, 0);
                        return;
                    }
                    setInfoModal({ title: 'Sucesso', message: 'Cliente cadastrado com sucesso!' });
                })
                .catch(err => {
                    if (isHandledError(err) && err.handled) return;
                    setFeedback({ type: 'error', message: 'Erro ao cadastrar: ' + (err?.message || '') });
                });
            return;
        }

        // ── UPDATE (PATCH) ───────────────────────────────────────────────────
        const payload: Partial<ClientData> = {};
        Object.keys(formData).forEach(key => {
            if (cliente && formData[key as keyof ClientData] !== cliente[key as keyof ClientData]) {
                (payload as Partial<Record<string, unknown>>)[key] = formData[key as keyof ClientData];
            }
        });
        if ('is_pregnant' in payload) payload.is_pregnant = !!formData.is_pregnant;
        if ('takes_medication' in payload) payload.takes_medication = formData.takes_medication ?? '';
        if ('had_surgery' in payload) payload.had_surgery = formData.had_surgery ?? '';

        const body: Record<string, unknown> = { ...payload };
        if ('first_name' in payload) body.first_name = (formData.first_name || '').trim();
        if ('last_name' in payload) body.last_name = (formData.last_name || '').trim();
        if ('email' in payload) { const e = (formData.email || '').trim(); body.email = e ? e.toLowerCase() : null; }
        if ('profession' in payload) { const p = (formData.profession || '').trim(); body.profession = p || null; }
        if ('phone' in payload) { const p = (formData.phone || '').trim(); body.phone = p ? p.replace(/\D/g, '') : null; }
        if ('address_number' in payload) { const ad = (formData.address_number || '').replace(/\D/g, '').slice(0, 16); body.address_number = ad || null; }
        if ('date_of_birth' in payload) body.date_of_birth = normalizeDOBForApi(formData.date_of_birth || null);

        fetch(`${API_BASE}/register/clients/${cliente.id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        })
            .then(async res => {
                if (!res.ok) {
                    let errorData: unknown = null;
                    try { errorData = await res.json(); } catch {
                        try { errorData = await res.text(); } catch { errorData = null; }
                    }
                    const errorMsg = parseApiError(errorData, res.status);
                    if (/telefone|phone/i.test(errorMsg) && /cadastr|existe|duplicad/i.test(errorMsg)) {
                        setInfoModal({ title: 'Atenção', message: errorMsg });
                        const err = new Error(errorMsg) as HandledError;
                        err.handled = true;
                        throw err;
                    }
                    setFeedback({ type: 'error', message: errorMsg });
                    const err = new Error(errorMsg) as HandledError;
                    err.handled = true;
                    throw err;
                }
                return res.json();
            })
            .then(async () => {
                try { if (cliente?.id) await saveAnamnesis(cliente.id, token); }
                catch (err) { console.warn('Falha ao salvar anamnese (não bloqueante):', err); }

                initialRef.current = JSON.stringify(formData);
                setDirty(false);
                setInfoModal({ title: 'Sucesso', message: 'Cliente atualizado com sucesso!' });
            })
            .catch(err => {
                if (isHandledError(err) && err.handled) return;
                setFeedback({ type: 'error', message: 'Erro ao salvar: ' + (err?.message || '') });
            });
    };

    const isEdit = !!cliente?.id;
    const deleteModalTitle = [cliente?.first_name, cliente?.last_name].filter(Boolean).join(' ').trim() || 'Excluir cliente';

    return (
        <>
            <form
                ref={formRef}
                onSubmit={handleSubmit}
                noValidate
                data-theme={theme}
            >
                <ClientPersonalDataForm
                    formData={formData}
                    handleChange={handleChange}
                    feedback={feedback}
                    isEdit={isEdit}
                />
                <ClientAddressForm
                    formData={formData}
                    handleChange={handleChange}
                    isEdit={isEdit}
                />
                <ClientAnamnesisForm
                    fields={anamnesisFields}
                    values={anamnesisValues}
                    isEdit={isEdit}
                    onChange={handleAnamnesisChange}
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
                    {isEdit && (
                        <button
                            type='button'
                            className={styles.btnDanger}
                            onClick={handleDelete}
                        >
                            Apagar
                        </button>
                    )}
                    <button
                        type='button'
                        className={styles.btnSecondary}
                        onClick={handleCancel}
                    >
                        Cancelar
                    </button>
                    <button type='submit' className={styles.btnPrimary}>
                        Salvar
                    </button>
                </div>
            </form>
            {infoModal && (
                <InfoModal
                    title={infoModal.title}
                    message={infoModal.message}
                    onClose={() => { setInfoModal(null); closeSuccessAndExit(); }}
                />
            )}
            {deleteModalOpen && (
                <DeleteConfirmModal
                    title={deleteModalTitle}
                    onConfirm={confirmDelete}
                    onCancel={cancelDelete}
                />
            )}
        </>
    );
}
