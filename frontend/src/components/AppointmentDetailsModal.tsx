import React from 'react';
import { useNavigate } from 'react-router-dom';
import AppModal from './Modal';
import type { SharedAppointmentLike } from './shared/AppointmentCard';
import { formatTime } from '../utils/timeFormat';
import StickyModalHeader from './shared/StickyModalHeader';
import { API_BASE } from '../config/api';
import { apiFetch } from '../utils/apiFetch';
import { useIsMobile } from '../hooks/useIsMobile';

type ChargeItem = {
    id: number;
    item_type: 'service' | 'product' | 'custom';
    service?: number | null;
    product?: number | null;
    description: string;
    quantity: string;
    unit_price: string;
    paid: boolean;
    paid_at?: string | null;
};

type Charge = {
    id: number;
    title: string;
    status: string;
    paid_at?: string | null;
    notes?: string;
    items: ChargeItem[];
};

function formatBRL(val: number): string {
    return Number(val || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

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
    const isCompactViewport = useIsMobile(640);
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
    // Charges for this appointment
    const [charges, setCharges] = React.useState<Charge[]>([]);
    React.useEffect(() => {
        if (!open || !appt) {
            setCharges([]);
            return;
        }
        apiFetch(`${API_BASE}/agenda/charges/?appointment=${appt.id}`)
            .then(data => {
                const raw = data as { results?: Charge[] } | Charge[];
                const list = Array.isArray(raw)
                    ? raw
                    : ((raw as { results?: Charge[] }).results ?? []);
                setCharges(list);
            })
            .catch(() => {
                /* silently ignore — charges are optional */
            });
    }, [open, appt]);
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

    const navigate = useNavigate();

    const clientId = React.useMemo(() => {
        if (!appt) return undefined;
        return typeof appt.client === 'number'
            ? appt.client
            : typeof appt.client === 'object' && appt.client
              ? (appt.client as { id?: number }).id
              : undefined;
    }, [appt]);

    const chargeRows = React.useMemo(
        () =>
            charges.flatMap(charge =>
                charge.items.map(item => ({
                    chargeStatus: charge.status,
                    item,
                    qty: parseFloat(item.quantity),
                    unit: parseFloat(item.unit_price),
                })),
            ),
        [charges],
    );

    const chargeTotal = React.useMemo(
        () =>
            chargeRows.reduce((sum, row) => sum + row.qty * row.unit, 0),
        [chargeRows],
    );

    const openConsultaNotebook = React.useCallback(() => {
        if (!appt) return;

        const chargeItems = charges.flatMap(c =>
            c.items.map(item => ({
                key:
                    item.item_type === 'service' && item.service
                        ? `service-${item.service}`
                        : item.item_type === 'product' && item.product
                          ? `product-${item.product}`
                          : `custom-${item.id}`,
                kind: (item.item_type === 'product' ? 'product' : 'service') as
                    | 'service'
                    | 'product',
                id:
                    item.item_type === 'service'
                        ? (item.service ?? item.id)
                        : (item.product ?? item.id),
                name: item.description,
                unit_price: parseFloat(item.unit_price),
                quantity: parseFloat(item.quantity),
                paid: item.paid,
                paidAt: item.paid
                    ? item.paid_at
                        ? item.paid_at.slice(0, 10)
                        : new Date().toISOString().slice(0, 10)
                    : undefined,
            })),
        );

        onClose();
        navigate('/consulta', {
            state: {
                appointmentId: appt.id,
                clientName,
                clientId,
                startAt: appt.start_at,
                endAt: appt.end_at,
                chargeId: charges[0]?.id,
                chargeItems,
                chargeNotes: charges[0]?.notes ?? '',
            },
        });
    }, [appt, charges, clientId, clientName, navigate, onClose]);

    if (!appt) return null;

    return (
        <AppModal
            open={open}
            onClose={onClose}
            unmountOnClose
            closeOnEnter={false}
            showCloseButton={false}
            actionsBarStyle={{
                background: 'transparent',
                borderBottom: 'none',
                boxShadow: 'none',
            }}
        >
            <div
                style={{
                    display: 'grid',
                    gap: 10,
                    width: '100%',
                    minWidth: 0,
                    maxWidth: '100%',
                    overflowX: 'hidden',
                }}
            >
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
                                fontSize: 17,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {clientName}
                        </div>
                        <div style={{ color: '#6b7280', fontSize: 16 }}>
                            {fmtDateTimeRange(appt.start_at, appt.end_at)}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gap: 6 }}>
                    <div>
                        <span style={{ fontWeight: 700, color: '#374151' }}>
                            Tipo:{' '}
                        </span>
                        <span style={{ color: '#111827' }}>
                            {appt.title || 'Atendimento'}
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
                    {/* Charges registrados no atendimento */}
                    {charges.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                            <div
                                style={{
                                    fontWeight: 700,
                                    color: '#374151',
                                    marginBottom: 6,
                                    fontSize: 18,
                                }}
                            >
                                Serviços prestados e produtos
                            </div>
                            {isCompactViewport ? (
                                <div
                                    style={{
                                        display: 'grid',
                                        gap: 10,
                                        width: '100%',
                                    }}
                                >
                                    {chargeRows.map(({ chargeStatus, item, qty, unit }) => (
                                        <div
                                            key={item.id}
                                            style={{
                                                border: '1px solid var(--color-border)',
                                                borderRadius: 12,
                                                padding: '10px 12px',
                                                background:
                                                    chargeStatus === 'paid'
                                                        ? 'var(--color-success-bg, #f0faf4)'
                                                        : 'var(--color-bg)',
                                                display: 'grid',
                                                gap: 8,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'flex-start',
                                                    gap: 8,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        fontSize: 17,
                                                        fontWeight: 700,
                                                        color: '#111827',
                                                        lineHeight: 1.25,
                                                        minWidth: 0,
                                                    }}
                                                >
                                                    {item.description}
                                                </div>
                                                <span
                                                    style={{
                                                        display: 'inline-block',
                                                        padding: '3px 10px',
                                                        borderRadius: 20,
                                                        fontSize: 13,
                                                        fontWeight: 700,
                                                        background: item.paid
                                                            ? 'var(--color-success, #22c55e)'
                                                            : '#f3f4f6',
                                                        color: item.paid
                                                            ? '#fff'
                                                            : '#6b7280',
                                                        border: item.paid
                                                            ? 'none'
                                                            : '1px solid #d1d5db',
                                                        whiteSpace: 'nowrap',
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    {item.paid ? 'Pago' : 'Pendente'}
                                                </span>
                                            </div>
                                            <div
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                                                    gap: 8,
                                                }}
                                            >
                                                <div>
                                                    <div
                                                        style={{
                                                            fontSize: 12,
                                                            fontWeight: 700,
                                                            color: '#6b7280',
                                                            textTransform: 'uppercase',
                                                        }}
                                                    >
                                                        Qtd
                                                    </div>
                                                    <div style={{ fontSize: 16, fontWeight: 600 }}>
                                                        {qty % 1 === 0 ? qty : qty.toFixed(2)}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div
                                                        style={{
                                                            fontSize: 12,
                                                            fontWeight: 700,
                                                            color: '#6b7280',
                                                            textTransform: 'uppercase',
                                                        }}
                                                    >
                                                        Unit.
                                                    </div>
                                                    <div style={{ fontSize: 16, fontWeight: 600 }}>
                                                        R$ {formatBRL(unit)}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div
                                                        style={{
                                                            fontSize: 12,
                                                            fontWeight: 700,
                                                            color: '#6b7280',
                                                            textTransform: 'uppercase',
                                                        }}
                                                    >
                                                        Valor
                                                    </div>
                                                    <div style={{ fontSize: 16, fontWeight: 700 }}>
                                                        R$ {formatBRL(qty * unit)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: 8,
                                            paddingTop: 2,
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: 14,
                                                fontWeight: 700,
                                                color: '#6b7280',
                                                textTransform: 'uppercase',
                                            }}
                                        >
                                            Total
                                        </span>
                                        <span
                                            style={{
                                                fontSize: 24,
                                                fontWeight: 800,
                                                color: '#111827',
                                            }}
                                        >
                                            R$ {formatBRL(chargeTotal)}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    style={{
                                        width: '100%',
                                        maxWidth: '100%',
                                        overflowX: 'auto',
                                        WebkitOverflowScrolling: 'touch',
                                    }}
                                >
                                    <table
                                        style={{
                                            width: '100%',
                                            minWidth: 0,
                                            borderCollapse: 'collapse',
                                            fontSize: 16,
                                        }}
                                    >
                                        <thead>
                                            <tr
                                                style={{
                                                    borderBottom:
                                                        '1px solid var(--color-border)',
                                                }}
                                            >
                                                <th
                                                    style={{
                                                        textAlign: 'left',
                                                        padding: '6px 8px',
                                                        fontWeight: 700,
                                                        color: '#4b5563',
                                                        fontSize: 16,
                                                    }}
                                                >
                                                    Item
                                                </th>
                                                <th
                                                    style={{
                                                        textAlign: 'center',
                                                        padding: '6px 8px',
                                                        fontWeight: 700,
                                                        color: '#4b5563',
                                                        whiteSpace: 'nowrap',
                                                        fontSize: 16,
                                                    }}
                                                >
                                                    Qtd
                                                </th>
                                                <th
                                                    style={{
                                                        textAlign: 'right',
                                                        padding: '6px 8px',
                                                        fontWeight: 700,
                                                        color: '#4b5563',
                                                        whiteSpace: 'nowrap',
                                                        fontSize: 16,
                                                    }}
                                                >
                                                    Unit.
                                                </th>
                                                <th
                                                    style={{
                                                        textAlign: 'right',
                                                        padding: '6px 8px',
                                                        fontWeight: 700,
                                                        color: '#4b5563',
                                                        whiteSpace: 'nowrap',
                                                        fontSize: 16,
                                                    }}
                                                >
                                                    Valor
                                                </th>
                                                <th
                                                    style={{
                                                        textAlign: 'center',
                                                        padding: '6px 8px',
                                                        fontWeight: 700,
                                                        color: '#4b5563',
                                                        whiteSpace: 'nowrap',
                                                        fontSize: 16,
                                                    }}
                                                >
                                                    Status
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {chargeRows.map(({ chargeStatus, item, qty, unit }) => (
                                                <tr
                                                    key={item.id}
                                                    style={{
                                                        borderBottom:
                                                            '1px solid var(--color-border)',
                                                        background:
                                                            chargeStatus ===
                                                            'paid'
                                                                ? 'var(--color-success-bg, #f0faf4)'
                                                                : undefined,
                                                    }}
                                                >
                                                    <td
                                                        style={{
                                                            padding: '7px 8px',
                                                            color: '#111827',
                                                            fontSize: 16,
                                                        }}
                                                    >
                                                        {item.description}
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: '7px 8px',
                                                            textAlign: 'center',
                                                            color: '#374151',
                                                            fontSize: 16,
                                                        }}
                                                    >
                                                        {qty % 1 === 0 ? qty : qty.toFixed(2)}
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: '7px 8px',
                                                            textAlign: 'right',
                                                            color: '#374151',
                                                            whiteSpace: 'nowrap',
                                                            fontSize: 16,
                                                        }}
                                                    >
                                                        R$ {formatBRL(unit)}
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: '7px 8px',
                                                            textAlign: 'right',
                                                            fontWeight: 600,
                                                            whiteSpace: 'nowrap',
                                                            fontSize: 16,
                                                        }}
                                                    >
                                                        R$ {formatBRL(qty * unit)}
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: '7px 8px',
                                                            textAlign: 'center',
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        <span
                                                            style={{
                                                                display: 'inline-block',
                                                                padding: '3px 10px',
                                                                borderRadius: 20,
                                                                fontSize: 13,
                                                                fontWeight: 700,
                                                                background: item.paid
                                                                    ? 'var(--color-success, #22c55e)'
                                                                    : '#f3f4f6',
                                                                color: item.paid
                                                                    ? '#fff'
                                                                    : '#6b7280',
                                                                border: item.paid
                                                                    ? 'none'
                                                                    : '1px solid #d1d5db',
                                                            }}
                                                        >
                                                            {item.paid ? 'Pago' : 'Pendente'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <td colSpan={3} />
                                                <td
                                                    style={{
                                                        padding: '9px 8px 3px',
                                                        textAlign: 'right',
                                                        fontWeight: 800,
                                                        fontSize: 20,
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    Total: R$ {formatBRL(chargeTotal)}
                                                </td>
                                                <td />
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
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
                        onClick={openConsultaNotebook}
                        style={{
                            padding: '8px 16px',
                            background: 'var(--color-primary)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        {charges.length > 0 ? 'Editar' : 'Anotar cobrança'}
                    </button>
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
