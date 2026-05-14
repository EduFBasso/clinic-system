import { useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { API_BASE } from '../config/api';
import { apiFetch, ApiError } from '../utils/apiFetch';
import { postDone } from '../services/appointments';
import type { ConsultaPageState } from './useConsultaPageContext';
import type { SelectedItem } from '../types/consulta';

interface UseConsultaRegisterParams {
    apptState: ConsultaPageState<SelectedItem>;
    selectedItems: SelectedItem[];
    notes: string;
    navigate: NavigateFunction;
    handleSuccessfulRegister: () => void;
}

interface UseConsultaRegisterResult {
    saving: boolean;
    error: string | null;
    handleRegister: () => Promise<void>;
}

export function useConsultaRegister({
    apptState,
    selectedItems,
    notes,
    navigate,
    handleSuccessfulRegister,
}: UseConsultaRegisterParams): UseConsultaRegisterResult {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleRegister() {
        if (saving) return;
        setSaving(true);
        setError(null);
        try {
            if (selectedItems.length > 0) {
                const payload: Record<string, unknown> = {
                    client: apptState.clientId,
                    appointment: apptState.appointmentId ?? null,
                    charge_type: 'charge',
                    title: `Atendimento${apptState.clientName ? ' — ' + apptState.clientName : ''}`,
                    notes: notes || undefined,
                    items: selectedItems.map(i => ({
                        item_type: i.kind === 'service' ? 'service' : 'product',
                        service: i.kind === 'service' ? i.id : null,
                        product: i.kind === 'product' ? i.id : null,
                        description: i.name,
                        quantity: String(i.quantity),
                        unit_price: String(i.unit_price),
                        paid: i.paid,
                        paid_at: i.paid && i.paidAt ? `${i.paidAt}T12:00:00Z` : null,
                    })),
                };
                if (apptState.chargeId) {
                    await apiFetch(
                        `${API_BASE}/agenda/charges/${apptState.chargeId}/`,
                        { method: 'PATCH', body: payload },
                    );
                } else {
                    await apiFetch(`${API_BASE}/agenda/charges/`, {
                        method: 'POST',
                        body: payload,
                    });
                }
            }
            if (apptState.appointmentId) {
                const markedDone = await postDone(apptState.appointmentId);
                if (!markedDone) {
                    throw new Error(
                        'O registro foi salvo, mas não foi possível concluir o atendimento.',
                    );
                }
            }
            handleSuccessfulRegister();
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                sessionStorage.setItem(
                    'loginRequiredMsg',
                    'Sessão expirada. Faça login novamente.',
                );
                navigate('/');
                return;
            }
            setError(
                err instanceof ApiError
                    ? err.message
                    : 'Erro ao registrar atendimento.',
            );
        } finally {
            setSaving(false);
        }
    }

    return { saving, error, handleRegister };
}
