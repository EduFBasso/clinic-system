import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { API_BASE } from '../../config/api';
import { apiFetch, ApiError } from '../../utils/apiFetch';
import InputField from '../../components/FormElements/InputField';
import FormPage from '../../components/FormKit/FormPage';
import FormSection from '../../components/FormKit/FormSection';
import FormActions from '../../components/FormKit/FormActions';
import SelectField from '../../components/FormKit/SelectField';
import CheckboxField from '../../components/FormKit/CheckboxField';

type ProductType = 'PRODUCT' | 'MEDICATION';

export default function ProductFormPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams<{ id: string }>();
    const returnTo: string =
        (location.state as { returnTo?: string } | null)?.returnTo ??
        '/catalog/products';

    const [name, setName] = useState('');
    const [type, setType] = useState<ProductType>('PRODUCT');
    const [scientificName, setScientificName] = useState('');
    const [sku, setSku] = useState('');
    const [unit, setUnit] = useState('un');
    // Exibição com 2 casas decimais em pt-BR
    const [priceStr, setPriceStr] = useState<string>('');
    const [costStr, setCostStr] = useState<string>('');
    const [trackInventory, setTrackInventory] = useState(true);
    const [quantityStr, setQuantityStr] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    function format2DecimalsBR(value: number): string {
        return value.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }

    function parseBRToNumber(str: string): number {
        // remove milhares '.' e troca ',' por '.'
        if (!str) return 0;
        const normalized = str.replace(/\./g, '').replace(',', '.');
        const n = Number(normalized);
        return Number.isFinite(n) ? n : 0;
    }

    function parseIntOnlyDigits(str: string): number {
        if (!str) return 0;
        const digits = str.replace(/\D/g, '');
        const n = Number(digits);
        return Number.isFinite(n) ? n : 0;
    }

    // Carregar dados existentes no modo edição
    useEffect(() => {
        if (!id) return;
        let mounted = true;
        (async () => {
            try {
                const data = await apiFetch(
                    `${API_BASE}/inventory/products/${id}/`,
                );
                if (!mounted) return;
                const p = data as {
                    name: string;
                    type: ProductType;
                    scientific_name?: string;
                    sku?: string;
                    unit?: string;
                    price: number;
                    cost: number;
                    track_inventory: boolean;
                    quantity_on_hand: number;
                };
                setName(p.name ?? '');
                setType(p.type ?? 'PRODUCT');
                setScientificName(p.scientific_name ?? '');
                setSku(p.sku ?? '');
                setUnit(p.unit ?? 'un');
                setPriceStr(format2DecimalsBR(p.price ?? 0));
                setCostStr(format2DecimalsBR(p.cost ?? 0));
                setTrackInventory(p.track_inventory ?? true);
                setQuantityStr(String(Math.round(p.quantity_on_hand ?? 0)));
            } catch (err) {
                if (!mounted) return;
                const msg = err instanceof ApiError ? err.message : String(err);
                setLoadError(msg || 'Erro ao carregar produto');
            }
        })();
        return () => {
            mounted = false;
        };
    }, [id]);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        if (!name.trim()) {
            setError('Informe o nome do produto.');
            return;
        }
        setSaving(true);
        try {
            const body = {
                name: name.trim(),
                type,
                scientific_name: scientificName.trim() || undefined,
                sku: sku.trim() || undefined,
                unit: unit.trim() || 'un',
                price: parseBRToNumber(priceStr) || 0,
                cost: parseBRToNumber(costStr) || 0,
                track_inventory: !!trackInventory,
                quantity_on_hand: parseIntOnlyDigits(quantityStr) || 0,
            };
            if (id) {
                await apiFetch(`${API_BASE}/inventory/products/${id}/`, {
                    method: 'PATCH',
                    body,
                });
            } else {
                await apiFetch(`${API_BASE}/inventory/products/`, {
                    method: 'POST',
                    body,
                });
            }
            try {
                localStorage.setItem(
                    'pendingSystemMessage',
                    JSON.stringify({
                        text: id
                            ? 'Produto atualizado com sucesso.'
                            : 'Produto salvo com sucesso.',
                        type: 'success',
                        autoCloseMs: 6000,
                    }),
                );
            } catch {
                // ignore storage errors
            }
            navigate(returnTo === '/consulta' ? -1 : returnTo);
        } catch (err) {
            const msg = err instanceof ApiError ? err.message : String(err);
            setError(msg || 'Erro ao salvar');
        } finally {
            setSaving(false);
        }
    }

    return (
        <FormPage
            title={id ? 'Editar Produto' : 'Novo Produto'}
            onSubmit={onSubmit}
        >
            <FormSection title='Dados do produto'>
                {loadError && (
                    <div
                        style={{
                            color: 'crimson',
                            fontSize: 13,
                            marginBottom: 8,
                        }}
                    >
                        {loadError}
                    </div>
                )}
                <InputField
                    label='Nome'
                    value={name}
                    onChange={e =>
                        setName((e.target as HTMLInputElement).value)
                    }
                    required
                    placeholder='Ex.: Creme hidratante'
                />
                <SelectField
                    label='Tipo'
                    value={type}
                    onChange={e =>
                        setType(
                            (e.target as HTMLSelectElement)
                                .value as ProductType,
                        )
                    }
                >
                    <option value='PRODUCT'>Produto</option>
                    <option value='MEDICATION'>Medicamento</option>
                </SelectField>
                <InputField
                    label='Nome clínico/laboratorial (opcional)'
                    value={scientificName}
                    onChange={e =>
                        setScientificName((e.target as HTMLInputElement).value)
                    }
                    placeholder='Ex.: Ácido salicílico 2%'
                />
                <InputField
                    label='SKU/Código (opcional)'
                    value={sku}
                    onChange={e => setSku((e.target as HTMLInputElement).value)}
                    placeholder='Ex.: SKU-001'
                />
                <InputField
                    label='Unidade'
                    value={unit}
                    onChange={e =>
                        setUnit((e.target as HTMLInputElement).value)
                    }
                    placeholder='un, ml, g'
                />
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                        <InputField
                            label='Preço (R$)'
                            type='text'
                            inputMode='decimal'
                            value={priceStr}
                            onChange={e => {
                                const v = (e.target as HTMLInputElement).value;
                                // permite apenas dígitos, vírgula e ponto
                                const cleaned = v.replace(/[^0-9.,]/g, '');
                                setPriceStr(cleaned);
                            }}
                            onFocus={e => e.target.select()}
                            onBlur={e => {
                                const n = parseBRToNumber(
                                    (e.target as HTMLInputElement).value,
                                );
                                setPriceStr(format2DecimalsBR(n));
                            }}
                            placeholder='0,00'
                        />
                    </div>
                    <div style={{ flex: 1, minWidth: 180 }}>
                        <InputField
                            label='Custo (R$)'
                            type='text'
                            inputMode='decimal'
                            value={costStr}
                            onChange={e => {
                                const v = (e.target as HTMLInputElement).value;
                                const cleaned = v.replace(/[^0-9.,]/g, '');
                                setCostStr(cleaned);
                            }}
                            onFocus={e => e.target.select()}
                            onBlur={e => {
                                const n = parseBRToNumber(
                                    (e.target as HTMLInputElement).value,
                                );
                                setCostStr(format2DecimalsBR(n));
                            }}
                            placeholder='0,00'
                        />
                    </div>
                </div>
                <div
                    style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                    }}
                >
                    <CheckboxField
                        label='Controla estoque'
                        checked={trackInventory}
                        onChange={e =>
                            setTrackInventory(
                                (e.target as HTMLInputElement).checked,
                            )
                        }
                    />
                    <div style={{ flex: 1, minWidth: 220 }}>
                        <InputField
                            label='Qtd em estoque'
                            type='text'
                            inputMode='numeric'
                            value={quantityStr}
                            onChange={e => {
                                const v = (e.target as HTMLInputElement).value;
                                const cleaned = v.replace(/[^0-9]/g, '');
                                setQuantityStr(cleaned);
                            }}
                            onFocus={e => e.target.select()}
                            onBlur={e => {
                                const cleaned = (
                                    e.target as HTMLInputElement
                                ).value.replace(/[^0-9]/g, '');
                                setQuantityStr(cleaned);
                            }}
                            placeholder='0'
                        />
                    </div>
                </div>
                {error && (
                    <div style={{ color: 'crimson', fontSize: 13 }}>
                        {error}
                    </div>
                )}
                <FormActions saving={saving} onCancel={() => navigate(-1)} />
            </FormSection>
        </FormPage>
    );
}
