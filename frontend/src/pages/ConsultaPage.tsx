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
import { useConsultaItems } from '../hooks/useConsultaItems';
import { useConsultaRegister } from '../hooks/useConsultaRegister';
import ItemsTable from '../components/consulta/ItemsTable';
import SelectedItemsTable from '../components/consulta/SelectedItemsTable';
import type { Service, Product, SelectedItem } from '../types/consulta';

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

export default function ConsultaPage() {
    const navigate = useNavigate();
    const [services, setServices] = useState<Service[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
    const [notes, setNotes] = useState('');

    const {
        apptState,
        saveAndNavigateToCatalog,
        handleSuccessfulRegister,
        returnToOrigin,
    } = useConsultaPageContext<SelectedItem>({ selectedItems, notes });

    // Sync items and notes from persisted appointment context (e.g. returning from catalog)
    useEffect(() => {
        setSelectedItems(apptState.chargeItems ?? []);
        setNotes(apptState.chargeNotes ?? '');
    }, [apptState.chargeItems, apptState.chargeNotes]);

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
        setFetchError(null);
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
                setFetchError(msg || 'Erro ao carregar dados');
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });
        return () => {
            mounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { addItem, removeItem, updateQty, togglePaid, updatePaidAt, total } =
        useConsultaItems({ selectedItems, setSelectedItems });

    const { saving, error: saveError, handleRegister } = useConsultaRegister({
        apptState,
        selectedItems,
        notes,
        navigate,
        handleSuccessfulRegister,
    });

    const displayError = fetchError || saveError;
    const activeServices = services.filter(s => s.is_active !== false);
    const activeProducts = products.filter(p => p.is_active !== false);

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
                {displayError && (
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
                        {displayError}
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
                <SelectedItemsTable
                    items={selectedItems}
                    total={total}
                    onRemove={removeItem}
                    onUpdateQty={updateQty}
                    onTogglePaid={togglePaid}
                    onUpdatePaidAt={updatePaidAt}
                />

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
                            cursor: saving ? 'not-allowed' : 'pointer',
                            fontSize: 16,
                            opacity: saving ? 0.55 : 1,
                            transition: 'background 0.2s',
                        }}
                    >
                        {saving ? 'Salvando\u2026' : 'Salvar Registro'}
                    </button>
                </div>
            </FormSection>
        </FormPage>
    );
}
