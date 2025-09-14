import React from 'react';
import AppModal from './Modal';
import type { Appointment } from '../hooks/useAppointments';

interface AppointmentDetailsModalProps {
    open: boolean;
    onClose: () => void;
    appointment: Appointment | null;
}

function fmtDateTime(iso: string) {
    if (!iso) return '';
    const d = new Date(iso);
    const date = d.toLocaleDateString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
    });
    const time = d.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    });
    return `${date} ${time}`;
}

export default function AppointmentDetailsModal({
    open,
    onClose,
    appointment,
}: AppointmentDetailsModalProps) {
    if (!appointment) return null;
    const {
        id,
        client_name,
        professional_name,
        title,
        visit_type,
        start_at,
        end_at,
        status,
        notes,
        location,
    } = appointment;

    const statusLabel: Record<string, string> = {
        scheduled: 'Agendado',
        done: 'Concluído',
        canceled: 'Cancelado',
    };

    return (
        <AppModal open={open} onClose={onClose}>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    minWidth: 300,
                }}
            >
                <h3
                    style={{
                        margin: 0,
                        fontSize: 22,
                        fontWeight: 600,
                        color: '#065f46',
                    }}
                >
                    Detalhes do Compromisso
                </h3>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '130px 1fr',
                        rowGap: 10,
                        columnGap: 14,
                        fontSize: 15,
                    }}
                >
                    <span style={{ fontWeight: 600, fontSize: 14 }}>ID:</span>
                    <span>{id}</span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                        Cliente:
                    </span>
                    <span>{client_name || '—'}</span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                        Profissional:
                    </span>
                    <span>{professional_name || '—'}</span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                        Título:
                    </span>
                    <span>{title || 'Consulta'}</span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Tipo:</span>
                    <span>{visit_type || '—'}</span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                        Início:
                    </span>
                    <span>{fmtDateTime(start_at)}</span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Fim:</span>
                    <span>{fmtDateTime(end_at)}</span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                        Duração:
                    </span>
                    <span>
                        {Math.round(
                            (new Date(end_at).getTime() -
                                new Date(start_at).getTime()) /
                                60000,
                        )}{' '}
                        min
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                        Status:
                    </span>
                    <span>{statusLabel[status] || status}</span>
                    {location && (
                        <>
                            <span style={{ fontWeight: 600, fontSize: 14 }}>
                                Local:
                            </span>
                            <span>{location}</span>
                        </>
                    )}
                    {notes && (
                        <>
                            <span
                                style={{
                                    fontWeight: 600,
                                    alignSelf: 'start',
                                    fontSize: 14,
                                }}
                            >
                                Notas:
                            </span>
                            <span style={{ whiteSpace: 'pre-wrap' }}>
                                {notes}
                            </span>
                        </>
                    )}
                </div>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 8,
                    }}
                >
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 18px',
                            border: '1px solid #065f46',
                            background: 'white',
                            color: '#065f46',
                            borderRadius: 8,
                            cursor: 'pointer',
                            fontSize: 15,
                        }}
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </AppModal>
    );
}
