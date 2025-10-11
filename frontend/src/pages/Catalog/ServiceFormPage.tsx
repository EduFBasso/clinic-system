import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../../config/api';
import { apiFetch, ApiError } from '../../utils/apiFetch';
import InputField from '../../components/FormElements/InputField';
import FormPage from '../../components/FormKit/FormPage';
import FormSection from '../../components/FormKit/FormSection';
import FormActions from '../../components/FormKit/FormActions';
import TextAreaField from '../../components/FormKit/TextAreaField';

export default function ServiceFormPage() {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    // Exibição com 2 casas decimais em pt-BR
    const [basePriceStr, setBasePriceStr] = useState<string>('');
    const [duration, setDuration] = useState<number>(30);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function format2DecimalsBR(value: number): string {
        return value.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }

    function parseBRToNumber(str: string): number {
        if (!str) return 0;
        const normalized = str.replace(/\./g, '').replace(',', '.');
        const n = Number(normalized);
        return Number.isFinite(n) ? n : 0;
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        if (!name.trim()) {
            setError('Informe o nome do serviço.');
            return;
        }
        setSaving(true);
        try {
            const body = {
                name: name.trim(),
                description: description.trim() || undefined,
                base_price: parseBRToNumber(basePriceStr) || 0,
                duration_minutes: Number(duration) || 30,
                is_active: true,
            };
            await apiFetch(`${API_BASE}/inventory/services/`, {
                method: 'POST',
                body,
            });
            try {
                localStorage.setItem(
                    'pendingSystemMessage',
                    JSON.stringify({
                        text: 'Serviço salvo com sucesso.',
                        type: 'success',
                        autoCloseMs: 6000,
                    }),
                );
            } catch {
                // ignore storage
            }
            navigate('/');
        } catch (err) {
            const msg = err instanceof ApiError ? err.message : String(err);
            setError(msg || 'Erro ao salvar');
        } finally {
            setSaving(false);
        }
    }

    return (
        <FormPage title='Novo Serviço' onSubmit={onSubmit}>
            <FormSection title='Dados do serviço'>
                <InputField
                    label='Nome'
                    value={name}
                    onChange={e =>
                        setName((e.target as HTMLInputElement).value)
                    }
                    required
                    placeholder='Ex.: Podologia clínica'
                />
                <TextAreaField
                    label='Descrição (opcional)'
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder='Detalhes do serviço'
                    rows={3}
                />
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                        <InputField
                            label='Preço base (R$)'
                            type='text'
                            inputMode='decimal'
                            value={basePriceStr}
                            onChange={e => {
                                const v = (e.target as HTMLInputElement).value;
                                const cleaned = v.replace(/[^0-9.,]/g, '');
                                setBasePriceStr(cleaned);
                            }}
                            onBlur={e => {
                                const n = parseBRToNumber(
                                    (e.target as HTMLInputElement).value,
                                );
                                setBasePriceStr(format2DecimalsBR(n));
                            }}
                            placeholder='0,00'
                        />
                    </div>
                    <div style={{ flex: 1, minWidth: 180 }}>
                        <InputField
                            label='Duração (min)'
                            type='number'
                            value={duration}
                            onChange={e =>
                                setDuration(
                                    Number(
                                        (e.target as HTMLInputElement).value,
                                    ),
                                )
                            }
                            min={5}
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
