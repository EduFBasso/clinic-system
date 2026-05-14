import React from 'react';
import type { Service, Product } from '../../types/consulta';
import { formatBRL } from '../../types/consulta';
import AddItemButton from './AddItemButton';

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

const editBtnStyle: React.CSSProperties = {
    background: 'transparent',
    color: 'var(--color-text-muted)',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    width: 32,
    height: 32,
    fontSize: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
    marginRight: 4,
    flexShrink: 0,
};

interface ItemsTableProps {
    rows: (Service | Product)[];
    kind: 'service' | 'product';
    onAdd: (kind: 'service' | 'product', item: Service | Product) => void;
    onEdit: (kind: 'service' | 'product', item: Service | Product) => void;
    emptyMsg: string;
}

export default function ItemsTable({
    rows,
    kind,
    onAdd,
    onEdit,
    emptyMsg,
}: ItemsTableProps) {
    return (
        <div style={{ overflowX: 'auto', marginBottom: 4 }}>
            <table
                style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 16,
                }}
            >
                <thead>
                    <tr style={{ background: 'var(--color-bg-alt, #f5f5f5)' }}>
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
                                    padding: '14px 10px',
                                    color: 'var(--color-text-muted)',
                                    textAlign: 'center',
                                    fontSize: 15,
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
                                        <AddItemButton
                                            onClick={() => onAdd(kind, item)}
                                            title={`Adicionar ${item.name}`}
                                        />
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
