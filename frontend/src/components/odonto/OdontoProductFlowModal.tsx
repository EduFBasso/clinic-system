import React from 'react';
import styles from '../../styles/pages/OdontoArcadePage.module.css';

type ProductRow = {
    name: string;
    value: string;
};

type Props = {
    open: boolean;
    saving: boolean;
    rows: ProductRow[];
    onClose: () => void;
    onSave: () => void;
    onRowsChange: (rows: ProductRow[]) => void;
};

export default function OdontoProductFlowModal({
    open,
    saving,
    rows,
    onClose,
    onSave,
    onRowsChange,
}: Props) {
    if (!open) return null;

    return (
        <div
            className={styles.serviceFlowOverlay}
            role='presentation'
            onClick={onClose}
        >
            <div
                className={styles.serviceFlowModal}
                role='dialog'
                aria-modal='true'
                aria-label='Novo produto'
                onClick={event => event.stopPropagation()}
            >
                <div className={styles.serviceFlowHeader}>
                    <div className={styles.serviceFlowHeaderMain}>
                        <h3 className={styles.sectionTitle}>Novo fluxo de produtos</h3>
                    </div>
                </div>

                <div className={styles.productFlowTopActions}>
                    <button
                        type='button'
                        className={styles.btnPrimary}
                        onClick={() =>
                            onRowsChange([
                                ...rows,
                                {
                                    name: '',
                                    value: '',
                                },
                            ])
                        }
                        disabled={saving}
                    >
                        + Produto
                    </button>
                </div>

                <div className={styles.serviceFlowRows}>
                    {rows.length === 0 && (
                        <p className={styles.textMuted}>Nenhum produto adicionado.</p>
                    )}
                    {rows.map((row, index) => (
                        <div key={index} className={styles.serviceFlowRow}>
                            <div className={styles.productFlowRowHeader}>
                                <strong>Produto {index + 1}</strong>
                                <button
                                    type='button'
                                    className={styles.iconBtnDanger}
                                    onClick={() =>
                                        onRowsChange(
                                            rows.filter((_, i) => i !== index),
                                        )
                                    }
                                    disabled={saving}
                                    aria-label='Remover produto'
                                    title='Remover produto'
                                >
                                    <svg
                                        viewBox='0 0 24 24'
                                        aria-hidden='true'
                                        className={styles.iconSvg}
                                    >
                                        <path
                                            d='M18 6 6 18M6 6l12 12'
                                            fill='none'
                                            stroke='currentColor'
                                            strokeWidth='2.5'
                                            strokeLinecap='round'
                                        />
                                    </svg>
                                </button>
                            </div>
                            <div className={styles.formGrid}>
                                <label className={styles.formLabel}>
                                    Nome *
                                    <input
                                        className={styles.input}
                                        value={row.name}
                                        onChange={event =>
                                            onRowsChange(
                                                rows.map((item, i) =>
                                                    i === index
                                                        ? {
                                                              ...item,
                                                              name: event.target
                                                                  .value,
                                                          }
                                                        : item,
                                                ),
                                            )
                                        }
                                        disabled={saving}
                                    />
                                </label>

                                <label className={styles.formLabel}>
                                    Valor
                                    <input
                                        type='text'
                                        inputMode='decimal'
                                        className={styles.input}
                                        placeholder='0,00'
                                        value={row.value}
                                        onChange={event =>
                                            onRowsChange(
                                                rows.map((item, i) =>
                                                    i === index
                                                        ? {
                                                              ...item,
                                                              value: event.target
                                                                  .value,
                                                          }
                                                        : item,
                                                ),
                                            )
                                        }
                                        disabled={saving}
                                    />
                                </label>
                            </div>
                        </div>
                    ))}
                </div>

                <div className={styles.modalActions}>
                    <button
                        type='button'
                        className={styles.btn}
                        onClick={onClose}
                        disabled={saving}
                    >
                        Cancelar
                    </button>
                    <button
                        type='button'
                        className={styles.btnPrimary}
                        onClick={onSave}
                        disabled={saving}
                    >
                        {saving ? 'Salvando...' : 'Salvar produtos'}
                    </button>
                </div>
            </div>
        </div>
    );
}
