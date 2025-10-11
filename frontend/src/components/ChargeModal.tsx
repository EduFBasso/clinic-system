import React from 'react';
import AppModal from './Modal';
import type { SharedAppointmentLike } from './shared/AppointmentCard';
import {
    buildChargeMessage,
    type ChargeItem,
    formatBRL,
} from '../utils/messages';
import { shareText } from '../utils/share';
import { formatPhone } from '../utils/formatPhone';

export interface ChargeModalProps {
    open: boolean;
    onClose: () => void;
    appt?: SharedAppointmentLike | null; // opcional: pode funcionar só com dados do cliente
    clientPhone?: string | null; // raw digits or any formatting
    clientName?: string; // quando appt não for fornecido
    professionalName?: string;
    professionalTitle?: string;
    addressLine?: string;
}

function normalizeDigits(s?: string | null): string | null {
    if (!s) return null;
    const digits = String(s).replace(/\D+/g, '');
    return digits || null;
}

function toE164BR(digits: string | null): string | undefined {
    if (!digits) return undefined;
    // If already starts with country code (55...), keep it; otherwise, prepend 55
    const d = digits.startsWith('55') ? digits : `55${digits}`;
    return d;
}

export default function ChargeModal({
    open,
    onClose,
    appt,
    clientPhone,
    clientName: clientNameProp,
    professionalName,
    professionalTitle,
    addressLine,
}: ChargeModalProps) {
    const [items, setItems] = React.useState<ChargeItem[]>([
        // exemplos iniciais (vazios, o usuário seleciona)
    ]);
    const [notes, setNotes] = React.useState<string>('');
    const [busy, setBusy] = React.useState(false);

    React.useEffect(() => {
        if (!open) return;
        // reset minimal ao abrir
        setBusy(false);
        setNotes('');
        setItems([]);
    }, [open]);

    if (!open) return null;

    const clientName = (() => {
        if (clientNameProp && clientNameProp.trim()) return clientNameProp;
        if (appt) {
            const fromApptName =
                appt.client_name ||
                (typeof appt.client === 'object' &&
                appt.client &&
                'name' in appt.client
                    ? String(
                          (appt.client as { name?: string }).name || 'Cliente',
                      )
                    : 'Cliente');
            return fromApptName;
        }
        return 'Cliente';
    })();

    // Data/hora resumida
    const whenLine = (() => {
        try {
            if (!appt) return undefined;
            const s = new Date(appt.start_at);
            const d = s
                .toLocaleDateString('pt-BR', {
                    weekday: 'short',
                    day: '2-digit',
                    month: '2-digit',
                })
                .replace('.', '');
            const hm = s.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
            });
            return `${d}, ${hm}`;
        } catch {
            return undefined;
        }
    })();

    const phoneDigits = normalizeDigits(clientPhone || null);
    const phoneE164 = toE164BR(phoneDigits);

    const total = items.reduce(
        (acc, it) => acc + (it.price || 0) * (it.qty || 1),
        0,
    );

    function addItemTemplate(label: string, price: number) {
        setItems(prev => [...prev, { label, price, qty: 1 }]);
    }
    function updateItem(idx: number, patch: Partial<ChargeItem>) {
        setItems(prev =>
            prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
        );
    }
    function removeItem(idx: number) {
        setItems(prev => prev.filter((_, i) => i !== idx));
    }

    async function handleSend() {
        if (busy) return;
        setBusy(true);
        try {
            const { text } = buildChargeMessage({
                clientName,
                professionalName,
                professionalTitle,
                addressLine,
                appointmentWhenLine: whenLine,
                items,
                notes,
            });
            const result = await shareText({ text, phoneE164 });
            try {
                window.dispatchEvent(
                    new CustomEvent('systemMessage', {
                        detail: {
                            text:
                                result === 'shared'
                                    ? 'Mensagem enviada pelo compartilhamento.'
                                    : result === 'opened-wa'
                                    ? 'Abrimos o WhatsApp com a mensagem.'
                                    : 'Mensagem copiada para a área de transferência.',
                            type: 'success',
                        },
                    }),
                );
            } catch {
                /* noop */
            }
            onClose();
        } catch (e) {
            const msg =
                e instanceof Error
                    ? e.message
                    : 'Falha ao gerar/enviar mensagem';
            try {
                window.dispatchEvent(
                    new CustomEvent('systemMessage', {
                        detail: { text: msg, type: 'error' },
                    }),
                );
            } catch {
                /* noop */
            }
        } finally {
            setBusy(false);
        }
    }

    return (
        <AppModal
            open={open}
            onClose={onClose}
            closeOnEnter={false}
            disableBackdropClose={true}
            disableEscapeKeyDown={true}
        >
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    minWidth: 320,
                }}
            >
                <h3 style={{ margin: 0 }}>Cobrança — WhatsApp</h3>
                <div style={{ fontSize: 13, color: '#374151' }}>
                    Cliente: <strong>{clientName}</strong>
                </div>
                <div style={{ fontSize: 13, color: '#374151' }}>
                    Telefone:{' '}
                    <strong>
                        {phoneDigits
                            ? formatPhone(phoneDigits)
                            : '— adicionar no cadastro do cliente'}
                    </strong>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                    {items.map((it, idx) => (
                        <div
                            key={idx}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 110px 70px 28px',
                                gap: 6,
                                alignItems: 'center',
                            }}
                        >
                            <input
                                value={it.label}
                                onChange={e =>
                                    updateItem(idx, { label: e.target.value })
                                }
                                placeholder='Serviço/Produto'
                                style={{ padding: 6 }}
                            />
                            <input
                                value={it.price ?? 0}
                                onChange={e =>
                                    updateItem(idx, {
                                        price: Number(e.target.value || 0),
                                    })
                                }
                                placeholder='Preço (R$)'
                                type='number'
                                step='0.01'
                                style={{ padding: 6 }}
                            />
                            <input
                                value={it.qty ?? 1}
                                onChange={e =>
                                    updateItem(idx, {
                                        qty: Number(e.target.value || 1),
                                    })
                                }
                                placeholder='Qtd'
                                type='number'
                                min={1}
                                step='1'
                                style={{ padding: 6 }}
                            />
                            <button
                                onClick={() => removeItem(idx)}
                                aria-label='Remover'
                                title='Remover'
                                style={{ padding: 4 }}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {/* Exemplos de atalhos padronizados (pode vir de config no futuro) */}
                        <button
                            onClick={() => addItemTemplate('Consulta', 120)}
                            style={{ padding: '6px 8px' }}
                        >
                            + Consulta
                        </button>
                        <button
                            onClick={() => addItemTemplate('Retorno', 80)}
                            style={{ padding: '6px 8px' }}
                        >
                            + Retorno
                        </button>
                        <button
                            onClick={() => addItemTemplate('Medicamento', 60)}
                            style={{ padding: '6px 8px' }}
                        >
                            + Medicamento
                        </button>
                        <button
                            onClick={() => addItemTemplate('Material', 30)}
                            style={{ padding: '6px 8px' }}
                        >
                            + Material
                        </button>
                        <button
                            onClick={() =>
                                setItems(prev => [
                                    ...prev,
                                    { label: '', price: 0, qty: 1 },
                                ])
                            }
                            style={{ padding: '6px 8px' }}
                        >
                            + Linha vazia
                        </button>
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            fontWeight: 700,
                        }}
                    >
                        Total: {formatBRL(total)}
                    </div>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder='Observações (opcional)'
                        rows={3}
                        style={{ padding: 6 }}
                    />
                </div>
                <div
                    style={{
                        display: 'flex',
                        gap: 8,
                        justifyContent: 'flex-end',
                    }}
                >
                    <button
                        onClick={onClose}
                        disabled={busy}
                        style={{ padding: '8px 12px', background: '#e5e7eb' }}
                    >
                        Fechar
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={busy || !items.length}
                        title={
                            items.length
                                ? 'Gerar e enviar'
                                : 'Adicione pelo menos um item'
                        }
                        style={{
                            padding: '8px 12px',
                            background: 'var(--color-done)',
                            color: '#fff',
                            fontWeight: 700,
                        }}
                    >
                        {busy ? 'Enviando…' : 'Enviar (WhatsApp)'}
                    </button>
                </div>
            </div>
        </AppModal>
    );
}
