// frontend/src/pages/ConsultaPage.tsx
// Página isolada para registrar atendimento (serviços e produtos usados + pagamento).
// Funciona standalone para testes; será linkada via PendingActionsModal depois.

import React, { useEffect, useState } from 'react';
import { API_BASE } from '../config/api';
import { apiFetch, ApiError } from '../utils/apiFetch';
import FormPage from '../components/FormKit/FormPage';
import FormSection from '../components/FormKit/FormSection';
import { useNavigate } from 'react-router-dom';
import { useConsultaPageContext } from '../hooks/useConsultaPageContext';
import { postDone } from '../services/appointments';

// ─── Types ──────────────────────────────────────────────────────────────────

type Service = {
    id: number;
    name: string;
    description?: string;
    base_price: number;
    duration_minutes: number;
    is_active: boolean;
};

type Product = {
    id: number;
    name: string;
    price: number; // campo no modelo é 'price'
    unit: string;
    is_active: boolean;
};

type SelectedItem = {
    key: string; // 'service-{id}' | 'product-{id}'
    kind: 'service' | 'product';
    id: number;
    name: string;
    unit_price: number;
    quantity: number;
    paid: boolean;
    paidAt?: string; // data do pagamento por item (ISO date: YYYY-MM-DD)
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBRL(val: number): string {
    return Number(val || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

// ─── Style constants ─────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
    padding: '10px 12px',
    textAlign: 'left',
    fontWeight: 700,
    fontSize: 14,
    color: '#4b5563',
    borderBottom: '2px solid var(--color-border)',
    whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
    padding: '11px 12px',
    verticalAlign: 'middle',
    color: 'var(--color-text)',
    fontSize: 16,
};

const addBtnStyle: React.CSSProperties = {
    background: 'var(--color-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    width: 34,
    height: 34,
    fontSize: 22,
    lineHeight: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    margin: '0 auto',
    padding: 0,
    transition:
        'transform 120ms ease, background-color 120ms ease, box-shadow 160ms ease, opacity 120ms ease',
    WebkitTapHighlightColor: 'transparent',
};

const editBtnStyle: React.CSSProperties = {
    background: 'transparent',
    color: 'var(--color-text-muted)',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    width: 32,
    height: 32,
    fontSize: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
    marginRight: 4,
    flexShrink: 0,
};

const linkBtnStyle: React.CSSProperties = {
    background: 'transparent',
    color: 'var(--color-primary)',
    border: '1px dashed var(--color-primary)',
    borderRadius: 8,
    padding: '9px 16px',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 15,
    marginTop: 8,
    boxShadow: 'var(--shadow-soft-sm)',
    transition:
        'transform 120ms ease, filter 120ms ease, box-shadow 160ms ease, background-color 140ms ease, color 140ms ease',
    WebkitTapHighlightColor: 'transparent',
};

// ─── ItemsTable ──────────────────────────────────────────────────────────────

interface ItemsTableProps {
    rows: (Service | Product)[];
    kind: 'service' | 'product';
    onAdd: (kind: 'service' | 'product', item: Service | Product) => void;
    onEdit: (kind: 'service' | 'product', item: Service | Product) => void;
    emptyMsg: string;
}

interface AddItemButtonProps {
    title: string;
    onClick: () => void;
}

function AddItemButton({ title, onClick }: AddItemButtonProps) {
    const [pressed, setPressed] = React.useState(false);
    const [confirmed, setConfirmed] = React.useState(false);

    React.useEffect(() => {
        if (!confirmed) return;
        const timeoutId = window.setTimeout(() => setConfirmed(false), 240);
        return () => window.clearTimeout(timeoutId);
    }, [confirmed]);

    return (
        <button
            onClick={() => {
                setConfirmed(true);
                onClick();
            }}
            onMouseDown={() => setPressed(true)}
            onMouseUp={() => setPressed(false)}
            onMouseLeave={() => setPressed(false)}
            onTouchStart={() => setPressed(true)}
            onTouchEnd={() => setPressed(false)}
            onTouchCancel={() => setPressed(false)}
            onBlur={() => setPressed(false)}
            style={{
                ...addBtnStyle,
                background: confirmed
                                        ? 'var(--color-primary)'
                    : pressed
                                            ? 'var(--color-primary)'
                      : 'var(--color-primary)',
                transform: confirmed
                    ? 'scale(1.08)'
                    : pressed
                      ? 'scale(0.94)'
                      : 'scale(1)',
                boxShadow: confirmed
                                        ? 'var(--shadow-soft-sm)'
                    : pressed
                                            ? 'inset 0 2px 8px color-mix(in oklab, var(--color-primary) 45%, #0000)'
                                            : 'var(--shadow-soft-sm)',
                opacity: pressed ? 0.96 : 1,
            }}
            title={title}
            aria-label={title}
            type='button'
        >
            <span
                aria-hidden='true'
                style={{
                    transform: confirmed ? 'scale(1.04)' : 'none',
                    transition: 'transform 120ms ease',
                }}
            >
                +
            </span>
        </button>
    );
}

function ItemsTable({ rows, kind, onAdd, onEdit, emptyMsg }: ItemsTableProps) {
    return (
        <div style={{ overflowX: 'auto', marginBottom: 4 }}>
            <table
                style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 16,
                }}
            >
                <thead>
                    <tr
                        style={{
                            background: 'var(--color-bg-alt, #f5f5f5)',
                        }}
                    >
                        <th style={thStyle}>Nome</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>
                            Preço
                        </th>
                        <th
                            style={{
                                ...thStyle,
                                width: 48,
                                textAlign: 'center',
                            }}
                        />
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td
                                colSpan={3}
                                style={{
                                    padding: '14px 10px',
                                    color: 'var(--color-text-muted)',
                                    textAlign: 'center',
                                    fontSize: 15,
                                }}
                            >
                                {emptyMsg}
                            </td>
                        </tr>
                    ) : (
                        rows.map(item => (
                            <tr
                                key={item.id}
                                style={{
                                    borderBottom:
                                        '1px solid var(--color-border)',
                                }}
                            >
                                <td style={tdStyle}>{item.name}</td>
                                <td
                                    style={{
                                        ...tdStyle,
                                        textAlign: 'right',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    R${' '}
                                    {formatBRL(
                                        kind === 'service'
                                            ? (item as Service).base_price
                                            : (item as Product).price,
                                    )}
                                </td>
                                <td
                                    style={{
                                        ...tdStyle,
                                        textAlign: 'center',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 4,
                                        }}
                                    >
                                        <button
                                            onClick={() => onEdit(kind, item)}
                                            style={editBtnStyle}
                                            title={`Editar ${item.name}`}
                                            type='button'
                                        >
                                            ✏️
                                        </button>
                                        <AddItemButton
                                            onClick={() => onAdd(kind, item)}
                                            title={`Adicionar ${item.name}`}
                                        />
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

// ─── ConsultaPage ────────────────────────────────────────────────────────────

export default function ConsultaPage() {
    const navigate = useNavigate();
    const [services, setServices] = useState<Service[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const todayISO = new Date().toISOString().slice(0, 10);
    const {
        apptState,
        saveAndNavigateToCatalog,
        handleSuccessfulRegister,
        returnToOrigin,
    } =
        useConsultaPageContext<SelectedItem>({
            selectedItems,
            notes,
        });

    useEffect(() => {
        setSelectedItems(apptState.chargeItems ?? []);
        setNotes(apptState.chargeNotes ?? '');
    }, [apptState.chargeItems, apptState.chargeNotes]);

    // Formata data/hora no mesmo estilo do AppointmentDetailsModal
    const apptSubtitle = React.useMemo(() => {
        if (!apptState.clientName || !apptState.startAt || !apptState.endAt)
            return null;
        const s = new Date(apptState.startAt);
        const e = new Date(apptState.endAt);
        const day = s.toLocaleDateString('pt-BR', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: '2-digit',
        });
        const sh = `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`;
        const eh = `${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}`;
        return `${day}, ${sh} - ${eh}`;
    }, [apptState.clientName, apptState.startAt, apptState.endAt]);

    // Fetch services and products in parallel
    useEffect(() => {
        let mounted = true;
        setLoading(true);
        setError(null);
        Promise.all([
            apiFetch(`${API_BASE}/inventory/services/`),
            apiFetch(`${API_BASE}/inventory/products/`),
        ])
            .then(([svcRaw, proRaw]) => {
                if (!mounted) return;
                setServices((Array.isArray(svcRaw) ? svcRaw : []) as Service[]);
                setProducts((Array.isArray(proRaw) ? proRaw : []) as Product[]);
            })
            .catch(err => {
                if (!mounted) return;
                if (err instanceof ApiError && err.status === 401) {
                    sessionStorage.setItem(
                        'loginRequiredMsg',
                        'Sessão expirada. Faça login novamente.',
                    );
                    navigate('/');
                    return;
                }
                const msg = err instanceof ApiError ? err.message : String(err);
                setError(msg || 'Erro ao carregar dados');
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, []);

    // ── Item management ──

    function addItem(kind: 'service' | 'product', item: Service | Product) {
        const key = `${kind}-${item.id}`;
        const unit_price =
            kind === 'service'
                ? (item as Service).base_price
                : (item as Product).price;
        setSelectedItems(prev => {
            const existing = prev.find(i => i.key === key);
            if (existing) {
                return prev.map(i =>
                    i.key === key ? { ...i, quantity: i.quantity + 1 } : i,
                );
            }
            return [
                ...prev,
                {
                    key,
                    kind,
                    id: item.id,
                    name: item.name,
                    unit_price,
                    quantity: 1,
                    paid: false,
                },
            ];
        });
    }

    function removeItem(key: string) {
        setSelectedItems(prev => prev.filter(i => i.key !== key));
    }

    function updateQty(key: string, qty: number) {
        if (qty < 1) return;
        setSelectedItems(prev =>
            prev.map(i => (i.key === key ? { ...i, quantity: qty } : i)),
        );
    }

    function togglePaid(key: string) {
        const targetItem = selectedItems.find(i => i.key === key);
        if (targetItem?.paid) {
            const shouldUnmark = window.confirm(
                'Remover a marcacao de pago deste item?',
            );
            if (!shouldUnmark) return;
        }
        setSelectedItems(prev =>
            prev.map(i =>
                i.key === key
                    ? {
                          ...i,
                          paid: !i.paid,
                          paidAt: !i.paid ? todayISO : undefined,
                      }
                    : i,
            ),
        );
    }

    function updatePaidAt(key: string, date: string) {
        setSelectedItems(prev =>
            prev.map(i => (i.key === key ? { ...i, paidAt: date } : i)),
        );
    }

    const total = selectedItems.reduce(
        (sum, i) => sum + i.unit_price * i.quantity,
        0,
    );

    async function handleRegister() {
        if (saving) return;
        setSaving(true);
        setError(null);
        try {
            if (selectedItems.length > 0) {
                // Fluxo completo: cria/atualiza Charge com itens + conclui
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
                        paid_at:
                            i.paid && i.paidAt ? `${i.paidAt}T12:00:00Z` : null,
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
            // Sempre conclui o agendamento (com ou sem itens financeiros)
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

    const activeServices = services.filter(s => s.is_active !== false);
    const activeProducts = products.filter(p => p.is_active !== false);

    // ── Render ──

    return (
        <FormPage
            title='Registrar Atendimento'
            onSubmit={e => e.preventDefault()}
        >
            {/* Contexto do agendamento quando vindo do PendingActionsModal */}
            {apptState.clientName && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: 'var(--color-bg-alt, #f5f7fa)',
                        border: '1px solid var(--color-border)',
                        marginBottom: 8,
                    }}
                >
                    <div
                        aria-hidden
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: '999px',
                            background: 'var(--color-primary)',
                            color: '#fff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 900,
                            fontSize: 18,
                            letterSpacing: 1,
                            flexShrink: 0,
                            userSelect: 'none',
                            border: '1px solid var(--color-border)',
                        }}
                    >
                        {apptState.clientName
                            .trim()
                            .split(/\s+/)
                            .filter(Boolean)
                            .reduce(
                                (acc, part, i, arr) =>
                                    i === 0 || i === arr.length - 1
                                        ? acc + part[0].toUpperCase()
                                        : acc,
                                '',
                            )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div
                            style={{
                                fontWeight: 800,
                                fontSize: 21,
                                color: 'var(--color-heading)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {apptState.clientName}
                        </div>
                        {apptSubtitle && (
                            <div
                                style={{
                                    color: '#6b7280',
                                    fontSize: 12,
                                    marginTop: 2,
                                }}
                            >
                                {apptSubtitle}
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* ── Serviços prestados ── */}
            <FormSection
                title='Serviços Prestados'
                onClose={returnToOrigin}
                closeTitle='Fechar sem salvar'
            >
                {error && (
                    <div
                        style={{
                            color: 'var(--color-danger)',
                            marginBottom: 12,
                            padding: '8px 12px',
                            background: 'var(--color-danger-bg, #fff0f0)',
                            borderRadius: 8,
                            border: '1px solid var(--color-danger)',
                            fontSize: 13,
                        }}
                    >
                        {error}
                    </div>
                )}
                {loading ? (
                    <div
                        style={{
                            color: 'var(--color-text-muted)',
                            fontSize: 15,
                            padding: '10px 0',
                        }}
                    >
                        Carregando...
                    </div>
                ) : (
                    <>
                        <ItemsTable
                            rows={activeServices}
                            kind='service'
                            onAdd={addItem}
                            onEdit={(_kind, item) =>
                                saveAndNavigateToCatalog(
                                    `/catalog/services/${item.id}`,
                                )
                            }
                            emptyMsg='Nenhum serviço cadastrado'
                        />
                        <button
                            type='button'
                            onClick={() =>
                                saveAndNavigateToCatalog('/catalog/services')
                            }
                            style={linkBtnStyle}
                        >
                            + Novo serviço
                        </button>
                    </>
                )}
            </FormSection>

            {/* ── Produtos ── */}
            <FormSection title='Produtos usados'>
                {loading ? (
                    <div
                        style={{
                            color: 'var(--color-text-muted)',
                            fontSize: 15,
                            padding: '10px 0',
                        }}
                    >
                        Carregando...
                    </div>
                ) : (
                    <>
                        <ItemsTable
                            rows={activeProducts}
                            kind='product'
                            onAdd={addItem}
                            onEdit={(_kind, item) =>
                                saveAndNavigateToCatalog(
                                    `/catalog/products/${item.id}`,
                                )
                            }
                            emptyMsg='Nenhum produto cadastrado'
                        />
                        <button
                            type='button'
                            onClick={() =>
                                saveAndNavigateToCatalog('/catalog/products')
                            }
                            style={linkBtnStyle}
                        >
                            + Novo produto
                        </button>
                    </>
                )}
            </FormSection>

            {/* ── Itens selecionados + total + ações ── */}
            <FormSection title='Itens selecionados'>
                {selectedItems.length === 0 ? (
                    <p
                        style={{
                            color: 'var(--color-text-muted)',
                            fontSize: 16,
                            margin: '8px 0 16px',
                        }}
                    >
                        Nenhum item adicionado ainda.
                    </p>
                ) : (
                    <>
                        <div style={{ overflowX: 'auto', marginBottom: 8 }}>
                            <table
                                style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    fontSize: 16,
                                }}
                            >
                                <thead>
                                    <tr
                                        style={{
                                            background:
                                                'var(--color-bg-alt, #f5f5f5)',
                                        }}
                                    >
                                        <th style={thStyle}>Item</th>
                                        <th
                                            style={{
                                                ...thStyle,
                                                width: 80,
                                                textAlign: 'center',
                                                fontSize: 16,
                                                fontWeight: 700,
                                                color: '#4b5563',
                                            }}
                                        >
                                            Qtd
                                        </th>
                                        <th
                                            style={{
                                                ...thStyle,
                                                textAlign: 'right',
                                                fontSize: 16,
                                                fontWeight: 700,
                                                color: '#4b5563',
                                            }}
                                        >
                                            Subtotal
                                        </th>
                                        <th
                                            style={{
                                                ...thStyle,
                                                width: 180,
                                                textAlign: 'center',
                                                fontSize: 16,
                                                fontWeight: 700,
                                                color: '#4b5563',
                                            }}
                                        />
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedItems.map(item => (
                                        <tr
                                            key={item.key}
                                            style={{
                                                borderBottom:
                                                    '1px solid var(--color-border)',
                                                background: item.paid
                                                    ? 'var(--color-success-bg, #f0faf4)'
                                                    : undefined,
                                                transition: 'background 0.2s',
                                            }}
                                        >
                                            <td style={tdStyle}>
                                                <span
                                                    style={{
                                                        fontSize: 16,
                                                        marginRight: 6,
                                                    }}
                                                >
                                                    {item.kind === 'service'
                                                        ? '📋'
                                                        : '📦'}
                                                </span>
                                                {item.name}
                                            </td>
                                            <td
                                                style={{
                                                    ...tdStyle,
                                                    textAlign: 'center',
                                                    fontSize: 16,
                                                }}
                                            >
                                                <input
                                                    type='number'
                                                    min={1}
                                                    value={item.quantity}
                                                    onChange={e =>
                                                        updateQty(
                                                            item.key,
                                                            parseInt(
                                                                e.target.value,
                                                                10,
                                                            ) || 1,
                                                        )
                                                    }
                                                    style={{
                                                        width: 56,
                                                        textAlign: 'center',
                                                        border: '1px solid var(--color-border)',
                                                        borderRadius: 6,
                                                        padding: '6px 8px',
                                                        fontSize: 16,
                                                        background:
                                                            'var(--color-bg)',
                                                        color: 'var(--color-text)',
                                                    }}
                                                />
                                            </td>
                                            <td
                                                style={{
                                                    ...tdStyle,
                                                    textAlign: 'right',
                                                    whiteSpace: 'nowrap',
                                                    fontWeight: 600,
                                                    fontSize: 16,
                                                }}
                                            >
                                                R${' '}
                                                {formatBRL(
                                                    item.unit_price *
                                                        item.quantity,
                                                )}
                                            </td>
                                            <td
                                                style={{
                                                    ...tdStyle,
                                                    textAlign: 'center',
                                                    whiteSpace: 'nowrap',
                                                    verticalAlign: 'middle',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        gap: 8,
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            alignItems:
                                                                'center',
                                                            gap: 8,
                                                        }}
                                                    >
                                                        <button
                                                            type='button'
                                                            onClick={() =>
                                                                removeItem(
                                                                    item.key,
                                                                )
                                                            }
                                                            title='Remover'
                                                            style={{
                                                                background:
                                                                    'none',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                color: 'var(--color-danger)',
                                                                fontSize: 20,
                                                                lineHeight: 1,
                                                                padding:
                                                                    '2px 4px',
                                                            }}
                                                        >
                                                            ×
                                                        </button>
                                                        <button
                                                            type='button'
                                                            onClick={() =>
                                                                togglePaid(
                                                                    item.key,
                                                                )
                                                            }
                                                            title={
                                                                item.paid
                                                                    ? 'Pago — clique para desmarcar'
                                                                    : 'Marcar como pago'
                                                            }
                                                            style={{
                                                                display: 'flex',
                                                                alignItems:
                                                                    'center',
                                                                gap: 6,
                                                                background:
                                                                    item.paid
                                                                        ? 'var(--color-success, #22c55e)'
                                                                        : 'transparent',
                                                                color: item.paid
                                                                    ? '#fff'
                                                                    : 'var(--color-text-muted)',
                                                                border: item.paid
                                                                    ? '1.5px solid var(--color-success, #22c55e)'
                                                                    : '1.5px solid var(--color-border)',
                                                                borderRadius: 20,
                                                                padding:
                                                                    '6px 12px 6px 8px',
                                                                fontSize: 16,
                                                                fontWeight: 700,
                                                                cursor: 'pointer',
                                                                whiteSpace:
                                                                    'nowrap',
                                                                lineHeight: 1.2,
                                                                transition:
                                                                    'all 0.15s',
                                                            }}
                                                        >
                                                            <span
                                                                style={{
                                                                    display:
                                                                        'flex',
                                                                    alignItems:
                                                                        'center',
                                                                    gap: 4,
                                                                }}
                                                            >
                                                                <span
                                                                    style={{
                                                                        fontSize: 16,
                                                                        lineHeight: 1,
                                                                    }}
                                                                >
                                                                    {item.paid
                                                                        ? '✓'
                                                                        : '○'}
                                                                </span>
                                                                Pago
                                                            </span>
                                                        </button>
                                                    </div>
                                                    {item.paid && (
                                                        <input
                                                            type='date'
                                                            value={
                                                                item.paidAt ??
                                                                todayISO
                                                            }
                                                            onChange={e =>
                                                                updatePaidAt(
                                                                    item.key,
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            onClick={e =>
                                                                e.stopPropagation()
                                                            }
                                                            style={{
                                                                border: '1px solid var(--color-success, #22c55e)',
                                                                borderRadius: 6,
                                                                padding:
                                                                    '6px 8px',
                                                                fontSize: 16,
                                                                background:
                                                                    'var(--color-bg)',
                                                                color: 'var(--color-text)',
                                                                WebkitAppearance:
                                                                    'none',
                                                                appearance:
                                                                    'none',
                                                                width: 136,
                                                                boxSizing:
                                                                    'border-box',
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Total */}
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                alignItems: 'center',
                                gap: 10,
                                padding: '10px 4px',
                                fontWeight: 700,
                                fontSize: 18,
                                color: 'var(--color-text)',
                                borderTop: '2px solid var(--color-border)',
                                marginBottom: 4,
                            }}
                        >
                            <span>Total:</span>
                            <span>R$ {formatBRL(total)}</span>
                        </div>
                    </>
                )}

                {/* Observações */}
                <div style={{ marginTop: 4 }}>
                    <label
                        style={{
                            display: 'block',
                            fontSize: 16,
                            fontWeight: 600,
                            color: 'var(--color-text-muted)',
                            marginBottom: 6,
                        }}
                    >
                        Observações (opcional)
                    </label>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={3}
                        placeholder='Anotações sobre o atendimento...'
                        style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            border: '1px solid var(--color-border)',
                            borderRadius: 8,
                            padding: '10px 12px',
                            fontSize: 16,
                            resize: 'vertical',
                            background: 'var(--color-bg)',
                            color: 'var(--color-text)',
                            fontFamily: 'inherit',
                        }}
                    />
                </div>

                {/* Botões de ação */}
                <div
                    style={{
                        display: 'flex',
                        gap: 12,
                        marginTop: 20,
                        justifyContent: 'flex-end',
                        flexWrap: 'wrap',
                    }}
                >
                    <button
                        type='button'
                        onClick={returnToOrigin}
                        style={{
                            background: 'transparent',
                            color: 'var(--color-text-muted)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 8,
                            padding: '10px 22px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: 16,
                        }}
                    >
                        ← Voltar
                    </button>
                    <button
                        type='button'
                        onClick={handleRegister}
                        disabled={saving}
                        style={{
                            background: 'var(--color-primary)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            padding: '10px 24px',
                            fontWeight: 700,
                            cursor: saving
                                    ? 'not-allowed'
                                    : 'pointer',
                            fontSize: 16,
                        opacity: saving ? 0.55 : 1,
                            transition: 'background 0.2s',
                        }}
                    >
                        {saving ? 'Salvando…' : 'Salvar Registro'}
                    </button>
                </div>
            </FormSection>
        </FormPage>
    );
}
