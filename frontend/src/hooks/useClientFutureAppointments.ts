import React from 'react';
import { API_BASE } from '../config/api';
import { getMaxScheduledPerClient } from '../config/limits';
import type { Appointment } from './useAppointments';
import type { ClientBasic } from '../types/ClientBasic';

interface Params {
    client: ClientBasic;
    isScheduled: boolean;
}

export interface UseClientFutureAppointmentsResult {
    futureAppointments: Appointment[];
    loadingFuture: boolean;
    dynLimit: number;
    totalScheduled: number; // includes current next when scheduled
    limitReached: boolean;
    refetch(): void;
}

/**
 * Encapsula fetch e gestão de compromissos futuros (após o próximo) de um cliente.
 * Responsável também por disparar aviso global quando limite é excedido.
 */
export function useClientFutureAppointments({
    client,
    isScheduled,
}: Params): UseClientFutureAppointmentsResult {
    const [futureAppointments, setFutureAppointments] = React.useState<
        Appointment[]
    >([]);
    const [loadingFuture, setLoadingFuture] = React.useState(false);
    const dynLimit = getMaxScheduledPerClient();
    // Stable reference to avoid creating a new [] on every call, preventing unnecessary re-renders
    const emptyRef = React.useRef<Appointment[]>([]);

    const fetchFuture = React.useCallback(() => {
        if (!isScheduled) {
            setFutureAppointments(emptyRef.current);
            return;
        }
        const token = localStorage.getItem('accessToken');
        if (!token) return;
        const startRef = client.next_appointment_start_at;
        if (!startRef) return;
        setLoadingFuture(true);
        const overfetchLimit = dynLimit + 5;
        const url = `${API_BASE}/agenda/appointments/?start=${encodeURIComponent(
            startRef,
        )}&limit=${overfetchLimit}&ordering=start_at&client=${client.id}`;
        fetch(url, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => (r.ok ? r.json() : []))
            .then((data: Appointment[]) => {
                const list = (Array.isArray(data) ? data : [])
                    .filter(a => a.status === 'scheduled')
                    .filter(a => a.id !== client.next_appointment_id);
                const total = (isScheduled ? 1 : 0) + list.length;
                if (total > dynLimit) {
                    try {
                        window.dispatchEvent(
                            new CustomEvent('systemMessage', {
                                detail: {
                                    text: `Excedido limite de ${dynLimit} compromissos (total atual: ${total}). Ajuste/cancelamento necessário.`,
                                    type: 'warning',
                                },
                            }),
                        );
                    } catch {
                        /* noop */
                    }
                }
                setFutureAppointments(list);
            })
            .catch(() => setFutureAppointments(emptyRef.current))
            .finally(() => setLoadingFuture(false));
    }, [
        client.id,
        client.next_appointment_id,
        client.next_appointment_start_at,
        dynLimit,
        isScheduled,
    ]);

    // Effect: initial + on deps change
    React.useEffect(() => {
        fetchFuture();
    }, [fetchFuture]);

    // Effect: listen global changes
    React.useEffect(() => {
        function onChanged() {
            fetchFuture();
        }
        window.addEventListener('appointments:changed', onChanged);
        return () =>
            window.removeEventListener('appointments:changed', onChanged);
    }, [fetchFuture]);

    const totalScheduled = (isScheduled ? 1 : 0) + futureAppointments.length;
    const limitReached = totalScheduled >= dynLimit;

    return {
        futureAppointments,
        loadingFuture,
        dynLimit,
        totalScheduled,
        limitReached,
        refetch: fetchFuture,
    };
}
