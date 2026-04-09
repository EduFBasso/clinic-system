import React from 'react';
import { formatTime } from '../../utils/timeFormat';
import styles from '../../styles/components/ClientCard.module.css';
import type { Appointment } from '../../hooks/useAppointments';
import { API_BASE } from '../../config/api';
import { FaEdit, FaEye } from 'react-icons/fa';

type Props = {
    items: Appointment[];
    valueColor: string;
    iconColor: string;
    labelColor: string;
    clientId: number;
    onEdit: (appt: Appointment) => void;
};

export default function FutureAppointmentsList({
    items,
    valueColor,
    iconColor,
    labelColor,
    onEdit,
}: Props) {
    if (!items.length) return null;
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                marginTop: 4,
            }}
        >
            <span
                className={styles.label}
                style={{ color: labelColor, fontWeight: 'bold' }}
            >
                Próximos compromissos:
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {items.slice(0, 7).map(f => {
                    const s = new Date(f.start_at);
                    const e = new Date(f.end_at);
                    const wd = s
                        .toLocaleDateString('pt-BR', { weekday: 'short' })
                        .replace('.', '')
                        .replace(/\b(\w)/, c => c.toUpperCase());
                    const dd = String(s.getDate()).padStart(2, '0');
                    const mm = String(s.getMonth() + 1).padStart(2, '0');
                    const fmt = (d: Date) => formatTime(d, { mode: 'local' });
                    return (
                        <div
                            key={f.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                                padding: '6px 8px',
                                background: 'var(--card-bg)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 6,
                                lineHeight: 1.25,
                            }}
                        >
                            <div
                                style={{
                                    flex: 1,
                                    minWidth: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    overflow: 'hidden',
                                }}
                            >
                                <span
                                    style={{
                                        fontWeight: 600,
                                        color: '#065f46',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {wd} {dd}/{mm}
                                </span>
                                <span
                                    style={{
                                        color: valueColor,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}
                                >
                                    {fmt(s)} - {fmt(e)}
                                </span>
                            </div>
                            <button
                                className={styles.iconButton}
                                title='Ver detalhes do compromisso'
                                onClick={e => {
                                    e.stopPropagation();
                                    const token =
                                        localStorage.getItem('accessToken');
                                    fetch(
                                        `${API_BASE}/agenda/appointments/${f.id}/`,
                                        {
                                            headers: {
                                                Authorization: token
                                                    ? `Bearer ${token}`
                                                    : '',
                                            },
                                        },
                                    )
                                        .then(r => (r.ok ? r.json() : null))
                                        .then(data => {
                                            const appt = (data ||
                                                f) as Appointment;
                                            try {
                                                window.dispatchEvent(
                                                    new CustomEvent(
                                                        'openAppointmentDetails',
                                                        {
                                                            detail: {
                                                                appointment:
                                                                    appt,
                                                            },
                                                        },
                                                    ),
                                                );
                                            } catch {
                                                /* noop */
                                            }
                                        })
                                        .catch(() => {
                                            window.dispatchEvent(
                                                new CustomEvent(
                                                    'openAppointmentDetails',
                                                    {
                                                        detail: {
                                                            appointment: f,
                                                        },
                                                    },
                                                ),
                                            );
                                        });
                                }}
                            >
                                <FaEye color={iconColor} />
                            </button>
                            <button
                                className={styles.iconButton}
                                title='Editar este compromisso'
                                onClick={e => {
                                    e.stopPropagation();
                                    const token =
                                        localStorage.getItem('accessToken');
                                    fetch(
                                        `${API_BASE}/agenda/appointments/${f.id}/`,
                                        {
                                            headers: {
                                                Authorization: token
                                                    ? `Bearer ${token}`
                                                    : '',
                                            },
                                        },
                                    )
                                        .then(r => (r.ok ? r.json() : null))
                                        .then(data => {
                                            onEdit((data || f) as Appointment);
                                        })
                                        .catch(() => {
                                            onEdit({ ...f } as Appointment);
                                        });
                                }}
                            >
                                <FaEdit color={iconColor} />
                            </button>
                        </div>
                    );
                })}
                {items.length > 7 && (
                    <div
                        style={{
                            fontSize: 11,
                            color: 'var(--color-text-muted)',
                            padding: '2px 4px',
                        }}
                    >
                        + {items.length - 7} outros agendados
                    </div>
                )}
            </div>
        </div>
    );
}
