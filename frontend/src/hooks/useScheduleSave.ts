import { useState } from 'react';
import type { ClientBasic } from '../types/ClientBasic';
import type { Appointment } from './useAppointments';
import { apiFetch, ApiError } from '../utils/apiFetch';
import { isTokenExpired } from '../utils/jwt';
import { getAccessToken } from '../utils/auth/session';
import { focusClientCard } from '../utils/focusClientCard';

export interface ScheduleSaveParams {
    client: ClientBasic | undefined;
    editingId: number | null;
    startISO: string;
    endISO: string;
    visitType: string;
    notes: string;
    onClose: () => void;
}

export interface ScheduleSaveResult {
    saving: boolean;
    error: string | null;
    offerReplace: boolean;
    conflicts: Appointment[];
    setError: (e: string | null) => void;
    setOfferReplace: (v: boolean) => void;
    submitCreate: (replacing?: boolean) => Promise<void>;
    replaceConflictsAndCreate: () => Promise<void>;
}

export function useScheduleSave({
    client,
    editingId,
    startISO,
    endISO,
    visitType,
    notes,
    onClose,
}: ScheduleSaveParams): ScheduleSaveResult {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [offerReplace, setOfferReplace] = useState(false);
    const [conflicts, setConflicts] = useState<Appointment[]>([]);

    async function submitCreate(replacing = false) {
        setError(null);
        const token = getAccessToken();
        if (isTokenExpired(token)) {
            setError('Sessão expirada. Faça login novamente.');
            return;
        }
        setSaving(true);
        try {
            const isEdit = !!editingId;
            const path = isEdit
                ? `/agenda/appointments/${editingId}/`
                : `/agenda/appointments/`;
            const method = isEdit ? 'PATCH' : 'POST';
            if (!client) {
                setError('Selecione um cliente antes de salvar.');
                setSaving(false);
                return;
            }
            const payload = isEdit
                ? { start_at: startISO, end_at: endISO, notes, visit_type: visitType }
                : { client: client.id, title: 'Consulta', visit_type: visitType, start_at: startISO, end_at: endISO, status: 'scheduled', notes };

            try {
                await apiFetch(path, { method, body: payload });
            } catch (e) {
                const err = e as ApiError | Error;
                const txt = err.message || '';
                if (!replacing && (/Conflito|conflict/i.test(txt) || (err as ApiError).status === 400)) {
                    setOfferReplace(true);
                    try {
                        const list = await apiFetch(
                            `/agenda/appointments/?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}&status=scheduled`,
                        ) as unknown;
                        setConflicts((Array.isArray(list) ? list : []) as Appointment[]);
                    } catch { /* ignore */ }
                    setError('Conflito detectado. Confirme se deseja substituir.');
                    return;
                }
                throw new Error(txt || 'Falha ao agendar.');
            }

            try {
                window.dispatchEvent(new Event('updateClients'));
                window.dispatchEvent(new CustomEvent('appointments:changed', { detail: {} }));
                setTimeout(() => {
                    try {
                        if (client) focusClientCard(client.id);
                        window.dispatchEvent(new CustomEvent('systemMessage', {
                            detail: {
                                type: 'success',
                                message: editingId
                                    ? 'Agendamento atualizado com sucesso'
                                    : 'Agendamento criado com sucesso',
                            },
                        }));
                    } catch { /* noop */ }
                }, 50);
            } catch { /* noop */ }

            onClose();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Erro ao agendar.');
        } finally {
            setSaving(false);
        }
    }

    async function replaceConflictsAndCreate() {
        setOfferReplace(false);
        setError(null);
        const token = getAccessToken();
        if (isTokenExpired(token)) {
            setError('Sessão expirada. Faça login novamente.');
            return;
        }
        setSaving(true);
        try {
            const list = await apiFetch(
                `/agenda/appointments/?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}&status=scheduled`,
            ) as unknown;
            const conflictList = (Array.isArray(list) ? list : []) as Array<{ id: number }>;
            for (const c of conflictList) {
                try {
                    await apiFetch(`/agenda/appointments/${c.id}/`, { method: 'PATCH', body: { status: 'canceled' } });
                } catch { /* ignore individual cancel errors */ }
            }
            await submitCreate(true);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Falha ao substituir conflitos.');
        } finally {
            setSaving(false);
        }
    }

    return {
        saving,
        error,
        offerReplace,
        conflicts,
        setError,
        setOfferReplace,
        submitCreate,
        replaceConflictsAndCreate,
    };
}
