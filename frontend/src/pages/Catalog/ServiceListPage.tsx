import React, { useEffect, useState } from 'react';
import { API_BASE } from '../../config/api';
import { apiFetch, ApiError } from '../../utils/apiFetch';
import FormPage from '../../components/FormKit/FormPage';
import FormSection from '../../components/FormKit/FormSection';
import { useNavigate } from 'react-router-dom';

type Service = {
    id: number;
    name: string;
    description?: string;
    base_price: number;
    duration_minutes: number;
};

function format2DecimalsBR(value: number): string {
    return Number(value || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export default function ServiceListPage() {
    const [items, setItems] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        let mounted = true;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const raw = await apiFetch(`${API_BASE}/inventory/services/`);
                if (!mounted) return;
                const data = (Array.isArray(raw) ? raw : []) as Service[];
                setItems(data);
            } catch (err) {
                const msg = err instanceof ApiError ? err.message : String(err);
                setError(msg || 'Erro ao carregar serviços');
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    // Exibe imediatamente a mensagem de sucesso ao retornar do formulário
    useEffect(() => {
        try {
            const raw = localStorage.getItem('pendingSystemMessage');
            if (raw) {
                const obj = JSON.parse(raw);
                if (obj && obj.text) {
                    setSuccessMsg(String(obj.text));
                    const ms =
                        typeof obj.autoCloseMs === 'number'
                            ? obj.autoCloseMs
                            : 6000;
                    setTimeout(() => setSuccessMsg(null), ms);
                }
                localStorage.removeItem('pendingSystemMessage');
            }
        } catch {
            /* noop */
        }
    }, []);

    return (
        <FormPage title='Procedimentos' onSubmit={e => e.preventDefault()}>
            <FormSection
                title='Lista'
                onClose={() => navigate('/')}
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
                        onClick={() => navigate(-1)}
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
                        style={{
                            background: 'var(--color-primary)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            padding: '8px 14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                        title='Novo procedimento'
                        onClick={() => navigate('/catalog/services/new')}
                    >
                        + Novo
                    </button>
                </div>
                <div
                    style={{
                        background: 'var(--color-bg-section)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 12,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                        padding: '6px 8px',
                    }}
                >
                    <div
                        style={{
                            overflowX: 'auto',
                            WebkitOverflowScrolling: 'touch',
                        }}
                    >
                        <table
                            style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                            }}
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
                                    <th
                                        style={{
                                            textAlign: 'left',
                                            padding: 8,
                                        }}
                                    >
                                        Nome
                                    </th>
                                    <th
                                        style={{
                                            textAlign: 'left',
                                            padding: 8,
                                            minWidth: 220,
                                        }}
                                    >
                                        Descrição (opcional)
                                    </th>
                                    <th
                                        style={{
                                            textAlign: 'left',
                                            padding: 8,
                                            minWidth: 140,
                                        }}
                                    >
                                        Preço base (R$)
                                    </th>
                                    <th
                                        style={{
                                            textAlign: 'left',
                                            padding: 8,
                                            minWidth: 120,
                                        }}
                                    >
                                        Duração (min)
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(s => (
                                    <tr
                                        key={s.id}
                                        style={{
                                            borderTop:
                                                '1px solid var(--border-subtle)',
                                        }}
                                    >
                                        <td style={{ padding: 8 }}>
                                            <button
                                                aria-label='Editar'
                                                title='Editar'
                                                onClick={() =>
                                                    navigate(
                                                        `/catalog/services/${s.id}`,
                                                    )
                                                }
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
                                        <td
                                            style={{
                                                padding: 8,
                                                minWidth: 220,
                                            }}
                                        >
                                            {s.name}
                                        </td>
                                        <td
                                            style={{
                                                padding: 8,
                                                minWidth: 220,
                                            }}
                                        >
                                            {String(s.description || '').trim()}
                                        </td>
                                        <td
                                            style={{
                                                padding: 8,
                                                minWidth: 140,
                                            }}
                                        >
                                            {format2DecimalsBR(
                                                Number(s.base_price || 0),
                                            )}
                                        </td>
                                        <td
                                            style={{
                                                padding: 8,
                                                minWidth: 120,
                                            }}
                                        >
                                            {Number(s.duration_minutes || 0)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {!loading && items.length === 0 && (
                            <div style={{ padding: 12, color: '#666' }}>
                                Nenhum procedimento cadastrado.
                            </div>
                        )}
                    </div>
                </div>
                {loading && <div style={{ padding: 12 }}>Carregando…</div>}
                {error && (
                    <div style={{ padding: 12, color: 'crimson' }}>{error}</div>
                )}
            </FormSection>
        </FormPage>
    );
}
