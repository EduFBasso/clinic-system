import React from 'react';
import type { SelectedItem } from '../../types/consulta';
import { formatBRL } from '../../types/consulta';

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

interface SelectedItemsTableProps {
    items: SelectedItem[];
    total: number;
    onRemove: (key: string) => void;
    onUpdateQty: (key: string, qty: number) => void;
    onTogglePaid: (key: string) => void;
    onUpdatePaidAt: (key: string, date: string) => void;
}

export default function SelectedItemsTable({
    items,
    total,
    onRemove,
    onUpdateQty,
    onTogglePaid,
    onUpdatePaidAt,
}: SelectedItemsTableProps) {
    const todayISO = new Date().toISOString().slice(0, 10);

    if (items.length === 0) {
        return (
            <p
                style={{
                    color: 'var(--color-text-muted)',
                    fontSize: 16,
                    margin: '8px 0 16px',
                }}
            >
                Nenhum item adicionado ainda.
            </p>
        );
    }

    return (
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
                                background: 'var(--color-bg-alt, #f5f5f5)',
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
                        {items.map(item => (
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
                                        {item.kind === 'service' ? '📋' : '📦'}
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
                                            onUpdateQty(
                                                item.key,
                                                parseInt(e.target.value, 10) ||
                                                    1,
                                            )
                                        }
                                        style={{
                                            width: 56,
                                            textAlign: 'center',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: 6,
                                            padding: '6px 8px',
                                            fontSize: 16,
                                            background: 'var(--color-bg)',
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
                                    R$ {formatBRL(item.unit_price * item.quantity)}
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
                                                alignItems: 'center',
                                                gap: 8,
                                            }}
                                        >
                                            <button
                                                type='button'
                                                onClick={() =>
                                                    onRemove(item.key)
                                                }
                                                title='Remover'
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: 'var(--color-danger)',
                                                    fontSize: 20,
                                                    lineHeight: 1,
                                                    padding: '2px 4px',
                                                }}
                                            >
                                                ×
                                            </button>
                                            <button
                                                type='button'
                                                onClick={() =>
                                                    onTogglePaid(item.key)
                                                }
                                                title={
                                                    item.paid
                                                        ? 'Pago — clique para desmarcar'
                                                        : 'Marcar como pago'
                                                }
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    background: item.paid
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
                                                    whiteSpace: 'nowrap',
                                                    lineHeight: 1.2,
                                                    transition: 'all 0.15s',
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 4,
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            fontSize: 16,
                                                            lineHeight: 1,
                                                        }}
                                                    >
                                                        {item.paid ? '✓' : '○'}
                                                    </span>
                                                    Pago
                                                </span>
                                            </button>
                                        </div>
                                        {item.paid && (
                                            <input
                                                type='date'
                                                value={item.paidAt ?? todayISO}
                                                onChange={e =>
                                                    onUpdatePaidAt(
                                                        item.key,
                                                        e.target.value,
                                                    )
                                                }
                                                onClick={e =>
                                                    e.stopPropagation()
                                                }
                                                style={{
                                                    border: '1px solid var(--color-success, #22c55e)',
                                                    borderRadius: 6,
                                                    padding: '6px 8px',
                                                    fontSize: 16,
                                                    background:
                                                        'var(--color-bg)',
                                                    color: 'var(--color-text)',
                                                    WebkitAppearance: 'none',
                                                    appearance: 'none',
                                                    width: 136,
                                                    boxSizing: 'border-box',
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
    );
}
