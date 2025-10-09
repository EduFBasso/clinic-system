import React from 'react';
import AppModal from './Modal';
import type { SharedAppointmentLike } from './shared/AppointmentCard';
import { formatTime } from '../utils/timeFormat';
import StickyModalHeader from './shared/StickyModalHeader';
import { API_BASE } from '../config/api';

export interface AppointmentDetailsModalProps {
    open: boolean;
    onClose: () => void;
    appt: SharedAppointmentLike | null;
}

function fmtDateTimeRange(startISO: string, endISO: string) {
    const s = new Date(startISO);
    const e = new Date(endISO);
    const day = s.toLocaleDateString('pt-BR', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    });
    const sh = formatTime(s, { mode: 'local' });
    const eh = formatTime(e, { mode: 'local' });
    return `${day}, ${sh} - ${eh}`;
}

export default function AppointmentDetailsModal({
    open,
    onClose,
    appt,
}: AppointmentDetailsModalProps) {
    const clientName = React.useMemo(() => {
        if (!appt) return 'Cliente';
        return (
            appt.client_name ||
            (typeof appt.client === 'object' &&
            appt.client &&
            'name' in appt.client
                ? String((appt.client as { name?: string }).name || 'Cliente')
                : 'Cliente')
        );
    }, [appt]);

    // Photo: prefer provided photo (client_photo) when available; else best-effort fetch by client id
    const [photoUrl, setPhotoUrl] = React.useState<string | null>(null);
    React.useEffect(() => {
        // Prefer existing photo if present in payload
        try {
            if (
                appt &&
                typeof appt.client_photo === 'string' &&
                appt.client_photo
            ) {
                setPhotoUrl(appt.client_photo);
            } else {
                setPhotoUrl(null);
            }
        } catch {
            setPhotoUrl(null);
        }
        try {
            if (!open || !appt) return;
            if (appt && appt.client_photo) return; // already have photo
            const clientId =
                typeof appt.client === 'number'
                    ? appt.client
                    : typeof appt.client === 'object' && appt.client
                    ? (appt.client as { id?: number }).id
                    : undefined;
            if (!clientId) return;
            const token = localStorage.getItem('accessToken');
            fetch(`${API_BASE}/register/clients/${clientId}/`, {
                headers: {
                    Authorization: token ? `Bearer ${token}` : '',
                },
                cache: 'no-store',
            })
                .then(r => (r.ok ? r.json() : null))
                .then(data => {
                    if (data && typeof data.photo === 'string') {
                        setPhotoUrl(data.photo as string);
                    }
                })
                .catch(() => {
                    /* ignore */
                });
        } catch {
            /* noop */
        }
    }, [open, appt]);

    const initials = React.useMemo(() => {
        const parts = String(clientName).trim().split(/\s+/).filter(Boolean);
        const first = parts[0]?.[0] || '';
        const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
        return (first + last).toUpperCase() || 'C';
    }, [clientName]);

    if (!appt) return null;

    return (
        <AppModal
            open={open}
            onClose={onClose}
            closeOnEnter={false}
            showCloseButton={false}
            actionsBarStyle={{
                background: 'transparent',
                borderBottom: 'none',
                boxShadow: 'none',
            }}
        >
            <div style={{ display: 'grid', gap: 10, minWidth: 320 }}>
                <StickyModalHeader
                    title='Detalhes do atendimento'
                    onClose={onClose}
                />
                {/* Client avatar + name summary */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '2px 0 6px',
                    }}
                >
                    {photoUrl ? (
                        <img
                            src={photoUrl}
                            alt={`Foto de ${clientName}`}
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: '999px',
                                objectFit: 'cover',
                                border: '1px solid var(--color-border)',
                            }}
                            loading='lazy'
                            decoding='async'
                            onError={ev => {
                                try {
                                    (
                                        ev.currentTarget as HTMLImageElement
                                    ).style.display = 'none';
                                } catch {
                                    /* noop */
                                }
                            }}
                        />
                    ) : (
                        <div
                            aria-hidden
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: '999px',
                                background: 'var(--color-success-dark)',
                                color: '#fff',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 900,
                                letterSpacing: 1,
                                userSelect: 'none',
                                border: '1px solid var(--color-border)',
                            }}
                            title={clientName}
                        >
                            {initials}
                        </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                        <div
                            style={{
                                fontWeight: 800,
                                color: 'var(--color-heading)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {clientName}
                        </div>
                        <div style={{ color: '#6b7280', fontSize: 12 }}>
                            {fmtDateTimeRange(appt.start_at, appt.end_at)}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gap: 6 }}>
                    <div>
                        <span style={{ fontWeight: 700, color: '#374151' }}>
                            Cliente:{' '}
                        </span>
                        <span style={{ color: '#111827' }}>{clientName}</span>
                    </div>
                    <div>
                        <span style={{ fontWeight: 700, color: '#374151' }}>
                            Tipo:{' '}
                        </span>
                        <span style={{ color: '#111827' }}>
                            {appt.title || 'Atendimento'}
                        </span>
                    </div>
                    <div>
                        <span style={{ fontWeight: 700, color: '#374151' }}>
                            Data e horário:{' '}
                        </span>
                        <span style={{ color: '#111827' }}>
                            {fmtDateTimeRange(appt.start_at, appt.end_at)}
                        </span>
                    </div>
                    <div>
                        <span style={{ fontWeight: 700, color: '#374151' }}>
                            Status:{' '}
                        </span>
                        <span
                            style={{
                                color: 'var(--color-done)',
                                fontWeight: 700,
                            }}
                        >
                            Concluído
                        </span>
                    </div>
                    {appt.notes && (
                        <div>
                            <span style={{ fontWeight: 700, color: '#374151' }}>
                                Observações:{' '}
                            </span>
                            <span style={{ color: '#111827' }}>
                                {appt.notes}
                            </span>
                        </div>
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
                        style={{ padding: '8px 12px', background: '#e5e7eb' }}
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </AppModal>
    );
}
