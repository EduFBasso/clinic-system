import React from 'react';
import AppModal from './Modal';
import type { SharedAppointmentLike } from './shared/AppointmentCard';

export interface AppointmentDetailsModalProps {
    open: boolean;
    onClose: () => void;
    appt: SharedAppointmentLike | null;
}

function fmtDateTimeRange(startISO: string, endISO: string) {
    const s = new Date(startISO);
    const e = new Date(endISO);
    const day = s.toLocaleDateString('en-GB', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    });
    const sh = s.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
    });
    const eh = e.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
    });
    return `${day}, ${sh} - ${eh}`;
}

export default function AppointmentDetailsModal({
    open,
    onClose,
    appt,
}: AppointmentDetailsModalProps) {
    if (!appt) return null;

    const clientName =
        appt.client_name ||
        (typeof appt.client === 'object' && appt.client && 'name' in appt.client
            ? String((appt.client as { name?: string }).name || 'Client')
            : 'Client');

    return (
        <AppModal open={open} onClose={onClose} closeOnEnter={false}>
            <div style={{ display: 'grid', gap: 10, minWidth: 320 }}>
                <h3 style={{ margin: 0 }}>Appointment details</h3>
                <div style={{ display: 'grid', gap: 6 }}>
                    <div>
                        <span style={{ fontWeight: 700, color: '#374151' }}>
                            Client:{' '}
                        </span>
                        <span style={{ color: '#111827' }}>{clientName}</span>
                    </div>
                    <div>
                        <span style={{ fontWeight: 700, color: '#374151' }}>
                            Type:{' '}
                        </span>
                        <span style={{ color: '#111827' }}>
                            {appt.title || 'Appointment'}
                        </span>
                    </div>
                    <div>
                        <span style={{ fontWeight: 700, color: '#374151' }}>
                            Date & time:{' '}
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
                            Concluded
                        </span>
                    </div>
                    {appt.notes && (
                        <div>
                            <span style={{ fontWeight: 700, color: '#374151' }}>
                                Notes:{' '}
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
                        Close
                    </button>
                </div>
            </div>
        </AppModal>
    );
}
