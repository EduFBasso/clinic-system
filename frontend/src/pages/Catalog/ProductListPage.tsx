import React, { useEffect, useState } from 'react';
import { API_BASE } from '../../config/api';
import { apiFetch, ApiError } from '../../utils/apiFetch';
import FormPage from '../../components/FormKit/FormPage';
import FormSection from '../../components/FormKit/FormSection';
import { useNavigate } from 'react-router-dom';

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
    const navigate = useNavigate();

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

    if (loading) return <div style={{ padding: 16 }}>Carregando…</div>;
    if (error)
        return <div style={{ padding: 16, color: 'crimson' }}>{error}</div>;

    return (
        <FormPage title='Produtos' onSubmit={e => e.preventDefault()}>
            <FormSection title='Lista'>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        marginBottom: 8,
                    }}
                >
                    <button
                        className='btn'
                        onClick={() => navigate('/catalog/products/new')}
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
                                            onClick={() => {
                                                // Próximo passo: abrir formulário de edição (rota dedicada)
                                                try {
                                                    window.dispatchEvent(
                                                        new CustomEvent(
                                                            'systemMessage',
                                                            {
                                                                detail: {
                                                                    text: 'Edição via formulário será adicionada no próximo passo.',
                                                                    type: 'info',
                                                                    autoCloseMs: 5000,
                                                                },
                                                            },
                                                        ),
                                                    );
                                                } catch {
                                                    /* noop */
                                                }
                                            }}
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
