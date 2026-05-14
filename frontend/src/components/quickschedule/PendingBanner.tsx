import React from 'react';
import type { ClientBasic } from '../../types/ClientBasic';
import type { PendingLike } from '../../hooks/usePendingGuard';
import type { Appointment } from '../../hooks/useAppointments';
import { API_BASE } from '../../config/api';
import { focusClientCard } from '../../utils/focusClientCard';
import { openPendingActionsForAppointment } from '../../utils/appointments/openPendingActions';

type ClientMaybeNext = ClientBasic & { next_appointment_id?: number };

interface PendingBannerProps {
    pendingFound: PendingLike;
    client: ClientMaybeNext;
    onClose: () => void;
}

export default function PendingBanner({
    pendingFound,
    client,
    onClose,
}: PendingBannerProps) {
    const handleResolve = React.useCallback(async () => {
        try {
            const id = (pendingFound?.id ||
                client.next_appointment_id) as number | undefined;
            if (!id) {
                focusClientCard(client.id);
                return;
            }
            const token = localStorage.getItem('accessToken');
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const resp = await fetch(
                `${API_BASE}/agenda/appointments/${id}/`,
                { headers },
            );
            if (!resp.ok)
                throw new Error('Falha ao carregar compromisso pendente');
            const appt = (await resp.json()) as Appointment;
            try {
                openPendingActionsForAppointment(appt);
            } catch {
                /* noop */
            }
        } catch (e) {
            const msg =
                e && typeof e === 'object' && 'message' in e
                    ? String((e as Error).message)
                    : 'Erro ao abrir pendência';
            try {
                window.dispatchEvent(
                    new CustomEvent('systemMessage', {
                        detail: { text: msg, type: 'warning' },
                    }),
                );
            } catch {
                /* noop */
            }
        }
    }, [pendingFound, client]);

    return (
        <div
            style={{
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                color: '#374151',
                padding: '8px 10px',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
            }}
        >
            <div>
                <strong>Atenção:</strong> há um compromisso pendente para este
                cliente. Finalize-o antes de criar um novo.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
                <button
                    onClick={handleResolve}
                    style={{ padding: '6px 10px', background: '#e5e7eb' }}
                >
                    Resolver agora
                </button>
                <button
                    onClick={onClose}
                    style={{ padding: '6px 10px', background: '#e5e7eb' }}
                >
                    Fechar
                </button>
            </div>
        </div>
    );
}
