import React from 'react';
import AppModal from './Modal';
import { shareText } from '../utils/share';
import {
    buildBudgetMessage,
    type ChargeItem,
    formatBRL,
} from '../utils/messages';
import { apiFetch, ApiError } from '../utils/apiFetch';
import { API_BASE } from '../config/api';
import { buildPixCopiaCola } from '../utils/pix';

// no extra phone helpers here; we'll normalize inline when sending

type Service = {
    id: string | number;
    name: string;
    base_price?: number | string | null;
};

type Product = {
    id: string | number;
    name: string;
    price?: number | string | null;
};

interface BudgetModalProps {
    open: boolean;
    onClose: () => void;
    clientName?: string;
    clientPhone?: string;
    professionalName?: string;
    professionalTitle?: string;
}

export default function BudgetModal({
    open,
    onClose,
    clientName,
    clientPhone,
    professionalName,
    professionalTitle,
}: BudgetModalProps) {
    const [items, setItems] = React.useState<ChargeItem[]>([]);
    const [priceDrafts, setPriceDrafts] = React.useState<string[]>([]);
    const [notes, setNotes] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [sendPix, setSendPix] = React.useState(false);
    const [pixKeyType, setPixKeyType] = React.useState<string>('');
    const [pixKeyValue, setPixKeyValue] = React.useState<string>('');
    const [profFirstName, setProfFirstName] = React.useState<string>('');
    const [profLastName, setProfLastName] = React.useState<string>('');
    const [services, setServices] = React.useState<Service[]>([]);
    const [products, setProducts] = React.useState<Product[]>([]);
    const [selServiceId, setSelServiceId] = React.useState<string>('');
    const [selProductId, setSelProductId] = React.useState<string>('');

    // Load on open: reset, fetch services/products, load professional + PIX settings
    React.useEffect(() => {
        if (!open) return;
        setBusy(false);
        setItems([]);
        setPriceDrafts([]);
        setNotes('');
        setServices([]);
        setProducts([]);
        setSelServiceId('');
        setSelProductId('');
        setSendPix(false);

        (async () => {
            try {
                const [svcs, prods] = await Promise.all([
                    apiFetch('/inventory/services/'),
                    apiFetch('/inventory/products/'),
                ]);
                setServices(Array.isArray(svcs) ? (svcs as Service[]) : []);
                setProducts(Array.isArray(prods) ? (prods as Product[]) : []);
            } catch (e) {
                const msg =
                    e instanceof ApiError
                        ? e.message
                        : 'Falha ao carregar catálogo';
                try {
                    window.dispatchEvent(
                        new CustomEvent('systemMessage', {
                            detail: { text: msg, type: 'error' },
                        }),
                    );
                } catch {
                    /* noop */
                }
            }
        })();

        try {
            const stored = localStorage.getItem('loggedProfessional');
            if (stored) {
                const prof = JSON.parse(stored) as {
                    first_name?: string;
                    last_name?: string;
                };
                setProfFirstName(prof.first_name || '');
                setProfLastName(prof.last_name || '');
            }
        } catch {
            /* noop */
        }

        (async () => {
            try {
                const token = localStorage.getItem('accessToken');
                if (!token) return;
                const res = await fetch(
                    `${API_BASE}/register/professionals/settings/`,
                    {
                        method: 'GET',
                        headers: { Authorization: `Bearer ${token}` },
                    },
                );
                if (!res.ok) return; // silencioso se indisponível
                const data = (await res.json()) as {
                    pix_key_type?: string;
                    pix_key_value?: string;
                };
                setPixKeyType(data.pix_key_type || '');
                setPixKeyValue(data.pix_key_value || '');
            } catch {
                /* noop */
            }
        })();
    }, [open]);

    // Efeito: ao marcar "Enviar PIX", injeta/remove:
    // 1) linha de título ("Título PIX … — Nome")
    // 2) linha da chave ("Chave PIX (Label): valor")
    React.useEffect(() => {
        const title = (() => {
            const parts: string[] = [];
            if (pixKeyType && pixKeyValue) {
                const label =
                    pixKeyType === 'cpf'
                        ? 'CPF'
                        : pixKeyType === 'telefone'
                        ? 'Telefone'
                        : pixKeyType === 'email'
                        ? 'E-mail'
                        : 'Chave';
                parts.push(`PIX ${label}: ${pixKeyValue}`);
            } else {
                parts.push('PIX');
            }
            const fullname = [profFirstName, profLastName]
                .filter(Boolean)
                .join(' ');
            if (fullname) parts.push(`— ${fullname}`);
            return `Título ${parts.join(' ')}`;
        })();
        const chaveLine = (() => {
            const label =
                pixKeyType === 'cpf'
                    ? 'CPF'
                    : pixKeyType === 'telefone'
                    ? 'Telefone'
                    : pixKeyType === 'email'
                    ? 'E-mail'
                    : 'Chave';
            return `Chave PIX (${label}): ${pixKeyValue || ''}`.trim();
        })();

        const nl = '\n';
        const cleanNotes = (notes || '').split(nl).filter(Boolean);
        const idxTitle = cleanNotes.findIndex(l => /^título\s+pix/i.test(l));
        const idxChave = cleanNotes.findIndex(l => /^chave\s+pix/i.test(l));
        if (sendPix) {
            if (idxTitle >= 0) cleanNotes[idxTitle] = title;
            else cleanNotes.unshift(title);
            if (chaveLine) {
                if (idxChave >= 0) cleanNotes[idxChave] = chaveLine;
                else cleanNotes.splice(1, 0, chaveLine);
            }
            setNotes(cleanNotes.join(nl));
        } else {
            let changed = false;
            if (idxTitle >= 0) {
                cleanNotes.splice(idxTitle, 1);
                changed = true;
            }
            const newIdxChave = cleanNotes.findIndex(l =>
                /^chave\s+pix/i.test(l),
            );
            if (newIdxChave >= 0) {
                cleanNotes.splice(newIdxChave, 1);
                changed = true;
            }
            if (changed) setNotes(cleanNotes.join(nl));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sendPix, pixKeyType, pixKeyValue, profFirstName, profLastName]);

    if (!open) return null;

    // Budget (🧾) deve abrir WhatsApp com a mensagem preenchida, sem amarrar em um número.
    // O ícone do WhatsApp no ClientCard continua abrindo direto no número do cliente.

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
        setPriceDrafts(prev => prev.filter((_, i) => i !== idx));
    }

    function priceToStringBR(value: number | undefined): string {
        const v = typeof value === 'number' && !isNaN(value) ? value : 0;
        const fixed = v.toFixed(2);
        return fixed.replace('.', ',');
    }
    function parseMoneyBR(input: string): number {
        if (!input) return 0;
        const cleaned = input
            .replace(/[^0-9,.]/g, '')
            .replace(/\./g, '')
            .replace(',', '.');
        const n = Number(cleaned);
        return isNaN(n) ? 0 : n;
    }

    async function handleSend() {
        if (busy) return;
        setBusy(true);
        try {
            // Se o usuário marcou Enviar PIX e temos chave, copia o "copia e cola" antes de abrir o WhatsApp
            if (sendPix && pixKeyValue) {
                try {
                    const pixText = buildPixCopiaCola({
                        key: pixKeyValue,
                        amount: total > 0 ? total : undefined,
                        merchantName: [profFirstName, profLastName]
                            .filter(Boolean)
                            .join(' '),
                        merchantCity: 'BRASIL',
                        description: 'ORCAMENTO',
                        txid: 'ORCAMENTO',
                    });
                    await navigator.clipboard.writeText(pixText);
                    try {
                        window.dispatchEvent(
                            new CustomEvent('systemMessage', {
                                detail: {
                                    text: 'PIX (copia e cola) copiado. Agora abriremos o WhatsApp.',
                                    type: 'success',
                                },
                            }),
                        );
                    } catch {
                        /* noop */
                    }
                } catch {
                    // Se não conseguir copiar, apenas segue com o envio
                }
            }
            const { text } = buildBudgetMessage({
                clientName,
                professionalName,
                professionalTitle,
                items,
                notes,
            });
            // Normaliza telefone do clientecard e abre WhatsApp diretamente nesse contato
            const digits = (clientPhone || '').replace(/\D+/g, '');
            const phoneE164 = digits
                ? digits.startsWith('55')
                    ? digits
                    : `55${digits}`
                : undefined;
            const result = await shareText({ text, phoneE164 });
            try {
                window.dispatchEvent(
                    new CustomEvent('systemMessage', {
                        detail: {
                            text:
                                result === 'shared'
                                    ? 'Orçamento enviado pelo compartilhamento.'
                                    : result === 'opened-wa'
                                    ? 'Abrimos o WhatsApp com o orçamento.'
                                    : 'Orçamento copiado para a área de transferência.',
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
                    : 'Falha ao gerar/enviar orçamento';
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
            disableBackdropClose
            disableEscapeKeyDown
        >
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    minWidth: 320,
                    width: '100%',
                    boxSizing: 'border-box',
                    overflowX: 'hidden',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <h3
                        style={{
                            margin: 0,
                            fontWeight: 700,
                            fontSize: 20,
                            textAlign: 'center',
                        }}
                    >
                        Orçamento — WhatsApp
                    </h3>
                    {/* X removido conforme solicitado */}
                </div>
                {clientName && (
                    <div style={{ fontSize: 16, color: '#111827' }}>
                        Cliente: <strong>{clientName}</strong>
                    </div>
                )}
                {/* Instrução breve sobre o botão + */}
                <div
                    style={{
                        fontSize: 12,
                        color: 'var(--color-text-muted)',
                        marginTop: -4,
                    }}
                >
                    Selecione um item e clique no “+” para adicionar uma nova
                    linha ao orçamento.
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                    {/* Procedimentos (Serviços) — limitar dropdown para não empurrar o botão + */}
                    <div
                        style={{
                            display: 'grid',
                            gap: 6,
                            gridTemplateColumns: 'minmax(0, 1fr) 52px',
                            alignItems: 'center',
                        }}
                    >
                        <select
                            value={selServiceId}
                            onChange={e => setSelServiceId(e.target.value)}
                            style={{
                                padding: 6,
                                width: '100%',
                                maxWidth: '70vw',
                                minWidth: 0,
                            }}
                        >
                            <option value=''>Procedimento</option>
                            {services.map(s => (
                                <option key={s.id} value={String(s.id)}>
                                    {s.name} —{' '}
                                    {formatBRL(Number(s.base_price || 0))}
                                </option>
                            ))}
                        </select>
                        <button
                            title={
                                selServiceId
                                    ? 'Adicionar linha'
                                    : 'Selecione um procedimento'
                            }
                            aria-label='Adicionar linha'
                            disabled={!selServiceId}
                            onClick={() => {
                                const s = services.find(
                                    x => String(x.id) === selServiceId,
                                );
                                if (!s) return;
                                addItemTemplate(
                                    s.name,
                                    Number(s.base_price || 0),
                                );
                                setSelServiceId('');
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 44,
                                height: 36,
                                padding: 0,
                                fontWeight: 800,
                                fontSize: 28,
                                background: 'transparent',
                                color: 'var(--color-success-dark)',
                                border: 'none',
                                borderRadius: 6,
                                lineHeight: 1,
                                cursor: selServiceId
                                    ? 'pointer'
                                    : 'not-allowed',
                                opacity: selServiceId ? 1 : 0.5,
                            }}
                        >
                            +
                        </button>
                    </div>

                    {/* Produtos (Medicamentos) — limitar dropdown para não empurrar o botão + */}
                    <div
                        style={{
                            display: 'grid',
                            gap: 6,
                            gridTemplateColumns: 'minmax(0, 1fr) 52px',
                            alignItems: 'center',
                        }}
                    >
                        <select
                            value={selProductId}
                            onChange={e => setSelProductId(e.target.value)}
                            style={{
                                padding: 6,
                                width: '100%',
                                maxWidth: '70vw',
                                minWidth: 0,
                            }}
                        >
                            <option value=''>Medicamento</option>
                            {products.map(p => (
                                <option key={p.id} value={String(p.id)}>
                                    {p.name} — {formatBRL(Number(p.price || 0))}
                                </option>
                            ))}
                        </select>
                        <button
                            title={
                                selProductId
                                    ? 'Adicionar linha'
                                    : 'Selecione um medicamento'
                            }
                            aria-label='Adicionar linha'
                            disabled={!selProductId}
                            onClick={() => {
                                const p = products.find(
                                    x => String(x.id) === selProductId,
                                );
                                if (!p) return;
                                setItems(prev => [
                                    ...prev,
                                    {
                                        label: p.name,
                                        price: Number(p.price || 0),
                                        qty: 1,
                                    },
                                ]);
                                setSelProductId('');
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 44,
                                height: 36,
                                padding: 0,
                                fontWeight: 800,
                                fontSize: 28,
                                background: 'transparent',
                                color: 'var(--color-success-dark)',
                                border: 'none',
                                borderRadius: 6,
                                lineHeight: 1,
                                cursor: selProductId
                                    ? 'pointer'
                                    : 'not-allowed',
                                opacity: selProductId ? 1 : 0.5,
                            }}
                        >
                            +
                        </button>
                    </div>
                    {/* Espaço após os dropdowns */}
                    <div style={{ height: 8 }} />
                    {items.length > 0 && (
                        <>
                            {/* Título e cabeçalho da lista de itens */}
                            <div
                                style={{
                                    fontWeight: 700,
                                    color: '#111827',
                                    textAlign: 'center',
                                    fontSize: 18,
                                }}
                            >
                                Orçamento
                            </div>
                            {sendPix && pixKeyValue && (
                                <div
                                    style={{
                                        marginTop: 6,
                                        padding: '10px 12px',
                                        background: 'var(--color-success-bg)',
                                        border: '1px solid var(--color-success-dark)',
                                        borderRadius: 8,
                                    }}
                                >
                                    <div
                                        style={{
                                            color: 'var(--color-success-dark)',
                                            fontWeight: 700,
                                            marginBottom: 4,
                                        }}
                                    >
                                        Chave PIX (confira)
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 18,
                                            fontWeight: 800,
                                            color: '#111827',
                                            wordBreak: 'break-all',
                                        }}
                                    >
                                        {(() => {
                                            const label =
                                                pixKeyType === 'cpf'
                                                    ? 'CPF'
                                                    : pixKeyType === 'telefone'
                                                    ? 'Telefone'
                                                    : pixKeyType === 'email'
                                                    ? 'E-mail'
                                                    : 'Chave';
                                            return `${label}: ${pixKeyValue}`;
                                        })()}
                                    </div>
                                </div>
                            )}
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 88px 35px 28px',
                                    gap: 6,
                                    alignItems: 'center',
                                    color: '#6b7280',
                                    fontSize: 16,
                                }}
                            >
                                <div>Tipo/Descrição</div>
                                <div style={{ textAlign: 'center' }}>Valor</div>
                                <div style={{ textAlign: 'right' }}>Qtde</div>
                                <div />
                            </div>

                            {/* Itens adicionados (edição livre de preço e qtd) */}
                            {items.map((it, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns:
                                            '1fr 88px 35px 28px',
                                        gap: 6,
                                        alignItems: 'center',
                                    }}
                                >
                                    <input
                                        value={it.label}
                                        onChange={e =>
                                            updateItem(idx, {
                                                label: e.target.value,
                                            })
                                        }
                                        placeholder='Serviço/Produto'
                                        style={{
                                            padding: 6,
                                            overflowX: 'hidden',
                                        }}
                                    />
                                    <input
                                        value={
                                            priceDrafts[idx] ??
                                            priceToStringBR(it.price)
                                        }
                                        onChange={e => {
                                            const val = e.target.value;
                                            setPriceDrafts(prev => {
                                                const next = prev.slice();
                                                next[idx] = val;
                                                return next;
                                            });
                                            const num = parseMoneyBR(val);
                                            updateItem(idx, { price: num });
                                        }}
                                        onBlur={() => {
                                            setPriceDrafts(prev => {
                                                const next = prev.slice();
                                                next[idx] = priceToStringBR(
                                                    items[idx]?.price,
                                                );
                                                return next;
                                            });
                                        }}
                                        placeholder='Preço (R$)'
                                        inputMode='decimal'
                                        style={{
                                            padding: 6,
                                            textAlign: 'center',
                                            width: '100%',
                                        }}
                                    />
                                    <input
                                        value={it.qty ?? 1}
                                        onChange={e =>
                                            updateItem(idx, {
                                                qty: Number(
                                                    e.target.value || 1,
                                                ),
                                            })
                                        }
                                        placeholder='Qtd'
                                        type='number'
                                        min={1}
                                        step={1}
                                        style={{
                                            padding: 6,
                                            textAlign: 'center',
                                            width: '100%',
                                        }}
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
                        </>
                    )}
                    {/* Total e Observações apenas se houver itens */}
                    {items.length > 0 && (
                        <>
                            <div
                                style={{
                                    display: 'grid',
                                    gap: 6,
                                    gridTemplateColumns: '1fr',
                                    alignItems: 'center',
                                }}
                            >
                                <div style={{ textAlign: 'right' }}>
                                    Total: <strong>{formatBRL(total)}</strong>
                                </div>
                            </div>
                            {/* Espaço em branco entre Total e Observações */}
                            <div style={{ height: 8 }} />
                            {/* Enviar PIX + Observações */}
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'auto 1fr',
                                    gap: 10,
                                    alignItems: 'start',
                                }}
                            >
                                <label
                                    style={{
                                        display: 'inline-flex',
                                        gap: 6,
                                        alignItems: 'center',
                                        whiteSpace: 'nowrap',
                                        userSelect: 'none',
                                        paddingTop: 4,
                                    }}
                                >
                                    <input
                                        type='checkbox'
                                        checked={sendPix}
                                        onChange={e =>
                                            setSendPix(e.target.checked)
                                        }
                                    />
                                    <span>Enviar PIX</span>
                                </label>
                                <textarea
                                    placeholder='Observações (opcional)'
                                    rows={3}
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    style={{ padding: 6, width: '100%' }}
                                />
                            </div>
                        </>
                    )}
                </div>

                <div
                    style={{
                        display: 'flex',
                        gap: 8,
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    {items.length > 0 && total <= 0 && (
                        <div
                            style={{
                                fontSize: 12,
                                color: '#6b7280',
                                padding: '4px 0',
                            }}
                        >
                            Informe um valor para pelo menos um item para
                            habilitar o envio.
                        </div>
                    )}
                    <button
                        onClick={onClose}
                        disabled={busy}
                        style={{ padding: '8px 12px', background: '#e5e7eb' }}
                    >
                        Fechar
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={busy || total <= 0}
                        title={
                            total > 0
                                ? 'Gerar e enviar'
                                : 'Adicione pelo menos um item'
                        }
                        style={{
                            padding: '10px 14px',
                            background: 'var(--color-success-dark)',
                            color: '#fff',
                            fontWeight: 700,
                            border: 'none',
                            borderRadius: 8,
                            cursor:
                                busy || total <= 0 ? 'not-allowed' : 'pointer',
                            opacity: busy || total <= 0 ? 0.6 : 1,
                        }}
                    >
                        {busy ? 'Enviando…' : 'Enviar'}
                    </button>
                </div>
            </div>
        </AppModal>
    );
}
