import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../../config/api';
import { apiFetch, ApiError } from '../../utils/apiFetch';
import FormPage from '../../components/FormKit/FormPage';
import FormSection from '../../components/FormKit/FormSection';
import { useLocation, useNavigate } from 'react-router-dom';
import { consumeFlashMessage } from '../../utils/flashMessage';

type Product = {
    id: number;
    name: string;
    type: 'PRODUCT' | 'MEDICATION';
    price: number;
    cost: number;
    track_inventory: boolean;
    quantity_on_hand: number;
};

function format2DecimalsBR(value: number): string {
    return Number(value || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export default function ProductListPage() {
    const [items, setItems] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const navigate = useNavigate();
    const location = useLocation();
    const returnTo =
        (location.state as { returnTo?: string } | null)?.returnTo ??
        '/catalog/products';
    const cameFromConsulta = returnTo === '/consulta';

    const handleClose = useMemo(
        () => () => {
            if (cameFromConsulta) {
                navigate(-1);
                return;
            }
            navigate('/');
        },
        [cameFromConsulta, navigate],
    );

    const openProductForm = useMemo(
        () =>
            (productId?: number) => {
                const path = productId
                    ? `/catalog/products/${productId}`
                    : '/catalog/products/new';
                navigate(path, { state: { returnTo } });
            },
        [navigate, returnTo],
    );

    useEffect(() => {
        let mounted = true;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await apiFetch(`${API_BASE}/inventory/products/`);
                if (!mounted) return;
                const list = (Array.isArray(data) ? data : []) as Product[];
                setItems(list);
            } catch (err) {
                const msg = err instanceof ApiError ? err.message : String(err);
                setError(msg || 'Erro ao carregar produtos');
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        const message = consumeFlashMessage('catalog-products');
        if (!message?.text) return;
        setSuccessMsg(String(message.text));
        const ms =
            typeof message.autoCloseMs === 'number'
                ? message.autoCloseMs
                : 6000;
        setTimeout(() => setSuccessMsg(null), ms);
    }, []);

    if (loading) return <div style={{ padding: 16 }}>Carregando…</div>;
    if (error)
        return <div style={{ padding: 16, color: 'crimson' }}>{error}</div>;

    return (
        <FormPage title='Produtos' onSubmit={e => e.preventDefault()}>
            <FormSection
                title='Lista'
                onClose={handleClose}
                closeTitle='Fechar'
            >
                {successMsg && (
                    <div
                        style={{
                            marginBottom: 8,
                            padding: '10px 12px',
                            background: 'var(--color-success-bg)',
                            border: '1px solid var(--color-success-dark)',
                            borderRadius: 8,
                            color: 'var(--color-success-dark)',
                            fontWeight: 600,
                        }}
                    >
                        {successMsg}
                    </div>
                )}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 12,
                        gap: 8,
                    }}
                >
                    <button
                        className='btn'
                        onClick={handleClose}
                        style={{
                            background: 'transparent',
                            color: 'var(--color-text)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 8,
                            padding: '8px 14px',
                            fontWeight: 500,
                            cursor: 'pointer',
                        }}
                        title='Voltar'
                    >
                        ← Voltar
                    </button>
                    <button
                        className='btn'
                        onClick={() => openProductForm()}
                        style={{
                            background: 'var(--color-primary)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            padding: '8px 14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        + Novo
                    </button>
                </div>
                <div
                    style={{
                        overflowX: 'auto',
                        WebkitOverflowScrolling: 'touch',
                    }}
                >
                    <table
                        style={{ width: '100%', borderCollapse: 'collapse' }}
                    >
                        <thead>
                            <tr>
                                <th
                                    style={{
                                        textAlign: 'left',
                                        padding: 8,
                                        width: 44,
                                    }}
                                />
                                <th style={{ textAlign: 'left', padding: 8 }}>
                                    Nome
                                </th>
                                <th
                                    style={{
                                        textAlign: 'left',
                                        padding: 8,
                                        minWidth: 120,
                                    }}
                                >
                                    Tipo
                                </th>
                                <th
                                    style={{
                                        textAlign: 'left',
                                        padding: 8,
                                        minWidth: 140,
                                    }}
                                >
                                    Preço (R$)
                                </th>
                                <th
                                    style={{
                                        textAlign: 'left',
                                        padding: 8,
                                        minWidth: 140,
                                    }}
                                >
                                    Custo (R$)
                                </th>
                                <th
                                    style={{
                                        textAlign: 'left',
                                        padding: 8,
                                        minWidth: 120,
                                    }}
                                >
                                    Estoque (un)
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map(p => (
                                <tr
                                    key={p.id}
                                    style={{
                                        borderTop:
                                            '1px solid var(--border-subtle)',
                                    }}
                                >
                                    <td style={{ padding: 8 }}>
                                        <button
                                            aria-label='Editar'
                                            title='Editar'
                                            onClick={() => openProductForm(p.id)}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontSize: 18,
                                            }}
                                        >
                                            ✏️
                                        </button>
                                    </td>
                                    <td style={{ padding: 8, minWidth: 220 }}>
                                        {p.name}
                                    </td>
                                    <td style={{ padding: 8 }}>
                                        {p.type === 'MEDICATION'
                                            ? 'Medicamento'
                                            : 'Produto'}
                                    </td>
                                    <td style={{ padding: 8 }}>
                                        {format2DecimalsBR(p.price)}
                                    </td>
                                    <td style={{ padding: 8 }}>
                                        {format2DecimalsBR(p.cost)}
                                    </td>
                                    <td style={{ padding: 8 }}>
                                        {Number(p.quantity_on_hand || 0)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </FormSection>
        </FormPage>
    );
}
