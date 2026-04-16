// frontend/src/pages/ConsultaPage.tsx
// Página isolada para registrar atendimento (serviços e produtos usados + pagamento).
// Funciona standalone para testes; será linkada via PendingActionsModal depois.

import React, { useEffect, useState } from 'react';
import { API_BASE } from '../config/api';
import { apiFetch, ApiError } from '../utils/apiFetch';
import FormPage from '../components/FormKit/FormPage';
import FormSection from '../components/FormKit/FormSection';
import { useNavigate, useLocation } from 'react-router-dom';

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
    padding: '8px 10px',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: 12,
    color: 'var(--color-text-muted)',
    borderBottom: '2px solid var(--color-border)',
    whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
    padding: '9px 10px',
    verticalAlign: 'middle',
    color: 'var(--color-text)',
    fontSize: 14,
};

const addBtnStyle: React.CSSProperties = {
    background: 'var(--color-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    width: 30,
    height: 30,
    fontSize: 20,
    lineHeight: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    margin: '0 auto',
    padding: 0,
};

const editBtnStyle: React.CSSProperties = {
    background: 'transparent',
    color: 'var(--color-text-muted)',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    width: 28,
    height: 28,
    fontSize: 14,
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
    padding: '7px 14px',
    fontWeight: 500,
    cursor: 'pointer',
    fontSize: 13,
    marginTop: 8,
};

// ─── ItemsTable ──────────────────────────────────────────────────────────────

interface ItemsTableProps {
    rows: (Service | Product)[];
    kind: 'service' | 'product';
    onAdd: (kind: 'service' | 'product', item: Service | Product) => void;
    onEdit: (kind: 'service' | 'product', item: Service | Product) => void;
    emptyMsg: string;
}

function ItemsTable({ rows, kind, onAdd, onEdit, emptyMsg }: ItemsTableProps) {
    return (
        <div style={{ overflowX: 'auto', marginBottom: 4 }}>
            <table
                style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 14,
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
                                    padding: '12px 8px',
                                    color: 'var(--color-text-muted)',
                                    textAlign: 'center',
                                    fontSize: 13,
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
                                        <button
                                            onClick={() => onAdd(kind, item)}
                                            style={addBtnStyle}
                                            title={`Adicionar ${item.name}`}
                                            type='button'
                                        >
                                            +
                                        </button>
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
    const location = useLocation();

    // Dados opcionais vindos do PendingActionsModal (via router state)
    // Fallback: sessionStorage quando voltamos de ServiceFormPage/ProductFormPage (navigate(-1) perde state)
    const [apptState] = useState<{
        appointmentId?: number;
        clientName?: string;
        clientId?: number;
        startAt?: string;
        endAt?: string;
        chargeId?: number;
        chargeItems?: SelectedItem[];
        chargeNotes?: string;
    }>(() => {
        const fromRouter = (location.state ?? {}) as {
            appointmentId?: number;
            clientName?: string;
            clientId?: number;
            startAt?: string;
            endAt?: string;
            chargeId?: number;
            chargeItems?: SelectedItem[];
            chargeNotes?: string;
        };
        if (fromRouter.appointmentId) return fromRouter;
        try {
            const saved = sessionStorage.getItem('consultaPageContext');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.appointmentId) {
                    sessionStorage.removeItem('consultaPageContext');
                    return parsed;
                }
            }
        } catch {
            /* noop */
        }
        return fromRouter;
    });

    // Salva contexto no sessionStorage e navega para edição de serviço/produto.
    // Ao voltar (navigate(-1)), ConsultaPage restaura o contexto do sessionStorage.
    function saveAndNavigateToCatalog(path: string) {
        try {
            sessionStorage.setItem(
                'consultaPageContext',
                JSON.stringify({
                    appointmentId: apptState.appointmentId,
                    clientId: apptState.clientId,
                    clientName: apptState.clientName,
                    startAt: apptState.startAt,
                    endAt: apptState.endAt,
                    chargeId: apptState.chargeId,
                    chargeItems: selectedItems,
                    chargeNotes: notes,
                }),
            );
        } catch {
            /* noop */
        }
        navigate(path, { state: { returnTo: '/consulta' } });
    }

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

    const [services, setServices] = useState<Service[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedItems, setSelectedItems] = useState<SelectedItem[]>(
        () => (apptState.chargeItems as SelectedItem[] | undefined) ?? [],
    );
    const [notes, setNotes] = useState(() => apptState.chargeNotes ?? '');
    const [saving, setSaving] = useState(false);
    const todayISO = new Date().toISOString().slice(0, 10);

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
        if (selectedItems.length === 0 || saving) return;
        setSaving(true);
        setError(null);
        try {
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
            // Item-level paid flags remain consultation annotations; charge status is controlled separately.
            if (apptState.chargeId) {
                await apiFetch(
                    `${API_BASE}/agenda/charges/${apptState.chargeId}/`,
                    { method: 'PATCH', body: payload },
                );
                // Sinaliza que deve reabrir o modal de detalhes ao voltar
                if (apptState.appointmentId) {
                    try {
                        sessionStorage.setItem(
                            'reopenAppointmentDetails',
                            String(apptState.appointmentId),
                        );
                    } catch {
                        /* noop */
                    }
                }
            } else {
                await apiFetch(`${API_BASE}/agenda/charges/`, {
                    method: 'POST',
                    body: payload,
                });
            }
            navigate(-1);
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
                            background: 'var(--color-success-dark)',
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
                                fontSize: 15,
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
            {/* ── Procedimentos ── */}
            <FormSection
                title='Procedimentos'
                onClose={() => navigate(-1)}
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
                            fontSize: 13,
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
                            emptyMsg='Nenhum procedimento cadastrado'
                        />
                        <button
                            type='button'
                            onClick={() => navigate('/catalog/services/new')}
                            style={linkBtnStyle}
                        >
                            + Novo procedimento
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
                            fontSize: 13,
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
                            onClick={() => navigate('/catalog/products/new')}
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
                            fontSize: 14,
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
                                    fontSize: 14,
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
                                            }}
                                        >
                                            Qtd
                                        </th>
                                        <th
                                            style={{
                                                ...thStyle,
                                                textAlign: 'right',
                                            }}
                                        >
                                            Subtotal
                                        </th>
                                        <th
                                            style={{
                                                ...thStyle,
                                                width: 140,
                                                textAlign: 'center',
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
                                                        fontSize: 12,
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
                                                        padding: '4px 6px',
                                                        fontSize: 14,
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
                                                        gap: 4,
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            alignItems:
                                                                'center',
                                                            gap: 6,
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
                                                                flexDirection:
                                                                    'column',
                                                                alignItems:
                                                                    'center',
                                                                gap: 1,
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
                                                                    '3px 10px 3px 6px',
                                                                fontSize: 12,
                                                                fontWeight: 600,
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
                                                                        fontSize: 14,
                                                                        lineHeight: 1,
                                                                    }}
                                                                >
                                                                    {item.paid
                                                                        ? '✓'
                                                                        : '○'}
                                                                </span>
                                                                Pago
                                                            </span>
                                                            {item.paid &&
                                                                item.paidAt && (
                                                                    <span
                                                                        style={{
                                                                            fontSize: 10,
                                                                            opacity: 0.9,
                                                                            letterSpacing:
                                                                                '0.01em',
                                                                        }}
                                                                    >
                                                                        {new Date(
                                                                            item.paidAt +
                                                                                'T12:00:00',
                                                                        ).toLocaleDateString(
                                                                            'pt-BR',
                                                                            {
                                                                                day: '2-digit',
                                                                                month: '2-digit',
                                                                                year: '2-digit',
                                                                            },
                                                                        )}
                                                                    </span>
                                                                )}
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
                                                                    '3px 6px',
                                                                fontSize: 11,
                                                                background:
                                                                    'var(--color-bg)',
                                                                color: 'var(--color-text)',
                                                                WebkitAppearance:
                                                                    'none',
                                                                appearance:
                                                                    'none',
                                                                width: 118,
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
                                fontSize: 17,
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
                            fontSize: 13,
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
                            fontSize: 14,
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
                        onClick={() => navigate(-1)}
                        style={{
                            background: 'transparent',
                            color: 'var(--color-text-muted)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 8,
                            padding: '10px 22px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            fontSize: 14,
                        }}
                    >
                        Pular
                    </button>
                    <button
                        type='button'
                        onClick={handleRegister}
                        disabled={selectedItems.length === 0 || saving}
                        style={{
                            background:
                                selectedItems.length === 0 || saving
                                    ? 'var(--color-border)'
                                    : 'var(--color-primary)',
                            color:
                                selectedItems.length === 0 || saving
                                    ? 'var(--color-text-muted)'
                                    : '#fff',
                            border: 'none',
                            borderRadius: 8,
                            padding: '10px 24px',
                            fontWeight: 700,
                            cursor:
                                selectedItems.length === 0 || saving
                                    ? 'default'
                                    : 'pointer',
                            fontSize: 14,
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
