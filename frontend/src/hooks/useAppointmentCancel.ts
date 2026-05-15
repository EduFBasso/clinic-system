import React from 'react';
import { dispatchers } from '../events/dispatchers';
import type { Appointment } from './useAppointments';
import { track } from '../utils/telemetry';
import { focusClientCard } from '../utils/focusClientCard';

interface UseAppointmentCancelParams {
    clientId: number;
    currentEdit: Appointment | null;
    lastEditedId: number | null;
    setCurrentEdit: (a: Appointment | null) => void;
    setEditingHighlightId: (id: number | null) => void;
    resetConflictFlow: () => void;
    setReloadKey: React.Dispatch<React.SetStateAction<number>>;
    setLastEditedId: (id: number | null) => void;
    setHighlightId: (id: number | null) => void;
    handleImmediateClose: () => void;
}

function dispatchSystemMessage(text: string, type: 'error' | 'warning') {
    try {
        window.dispatchEvent(
            new CustomEvent('systemMessage', { detail: { text, type } }),
        );
    } catch {
        /* noop */
    }
}

export function useAppointmentCancel({
    clientId,
    currentEdit,
    lastEditedId,
    setCurrentEdit,
    setEditingHighlightId,
    resetConflictFlow,
    setReloadKey,
    setLastEditedId,
    setHighlightId,
    handleImmediateClose,
}: UseAppointmentCancelParams) {
    const handleCancel = React.useCallback(
        async (a: Appointment) => {
            try {
                const { cancelAppointment } = await import(
                    '../services/appointments'
                );
                const res = await cancelAppointment(a.id);
                if (!res.ok) {
                    throw new Error(res.text || 'Erro ao cancelar');
                }
                setReloadKey(k => k + 1);
                try {
                    track({
                        type: 'appointment_cancel_succeeded',
                        payload: { id: a.id },
                    });
                } catch {
                    /* noop */
                }
                try {
                    dispatchers.updateClients();
                    dispatchers.appointmentsChanged();
                } catch {
                    /* noop */
                }
                setTimeout(() => focusClientCard(clientId), 120);
                if (currentEdit?.id === a.id) {
                    setCurrentEdit(null);
                    setEditingHighlightId(null);
                    resetConflictFlow();
                }
                if (lastEditedId === a.id) {
                    setLastEditedId(null);
                    setHighlightId(null);
                }
                try {
                    handleImmediateClose();
                } catch {
                    /* noop */
                }
            } catch (err) {
                const msg =
                    err && typeof err === 'object' && 'message' in err
                        ? String((err as Error).message)
                        : 'Erro ao cancelar';
                try {
                    console.warn('[QuickSchedule] cancel failed', {
                        id: a.id,
                        msg,
                    });
                } catch {
                    /* noop */
                }
                dispatchSystemMessage(msg, 'error');
                try {
                    track({
                        type: 'appointment_cancel_failed',
                        payload: { id: a.id, error: msg },
                    });
                } catch {
                    /* noop */
                }
            }
        },
        [
            clientId,
            currentEdit,
            lastEditedId,
            setCurrentEdit,
            setEditingHighlightId,
            resetConflictFlow,
            setReloadKey,
            setLastEditedId,
            setHighlightId,
            handleImmediateClose,
        ],
    );

    return { handleCancel };
}
