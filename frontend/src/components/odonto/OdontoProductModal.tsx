import React from 'react';
import type { ProductCatalogItem, ProductRow } from '../../pages/odontoArcadeHelpers';
import { normalizeMoneyInput, normalizeSearchText } from '../../pages/odontoArcadeHelpers';
import { toInputAmount } from '../../utils/currency';
import styles from '../../styles/pages/OdontoArcadeSimplifiedPage.module.css';

type Props = {
    open: boolean;
    saving: boolean;
    productRows: ProductRow[];
    productCatalog: ProductCatalogItem[];
    savingSuggestionIndex: number | null;
    onClose: () => void;
    onSave: () => void;
    onRowsChange: (rows: ProductRow[]) => void;
    onSaveSuggestion: (index: number) => void;
};

function filteredCatalog(catalog: ProductCatalogItem[], searchRaw: string): ProductCatalogItem[] {
    const sorted = [...catalog].sort((a, b) =>
        a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }),
    );
    const search = normalizeSearchText(searchRaw);
    if (!search) return sorted.slice(0, 24);

    return sorted
        .filter(item => normalizeSearchText(item.name).includes(search))
        .sort((a, b) => {
            const aN = normalizeSearchText(a.name);
            const bN = normalizeSearchText(b.name);
            const aStarts = aN.startsWith(search) ? 0 : 1;
            const bStarts = bN.startsWith(search) ? 0 : 1;
            if (aStarts !== bStarts) return aStarts - bStarts;
            const aIndex = aN.indexOf(search);
            const bIndex = bN.indexOf(search);
            if (aIndex !== bIndex) return aIndex - bIndex;
            return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
        })
        .slice(0, 24);
}

function catalogExistsByName(catalog: ProductCatalogItem[], nameRaw: string): boolean {
    const normalized = nameRaw.trim().toLowerCase();
    if (!normalized) return false;
    return catalog.some(item => item.name.trim().toLowerCase() === normalized);
}

export default function OdontoProductModal({
    open,
    saving,
    productRows,
    productCatalog,
    savingSuggestionIndex,
    onClose,
    onSave,
    onRowsChange,
    onSaveSuggestion,
}: Props) {
    const [openDropdownIndex, setOpenDropdownIndex] = React.useState<number | null>(null);

    if (!open) return null;

    function updateRow(index: number, patch: Partial<ProductRow>) {
        onRowsChange(productRows.map((item, i) => (i === index ? { ...item, ...patch } : item)));
    }

    return (
        <div className={styles.modalOverlay} role='presentation' onClick={onClose}>
            <div
                className={styles.modalCard}
                role='dialog'
                onClick={event => event.stopPropagation()}
            >
                <h3 className={styles.sectionTitle}>Novo fluxo de produtos</h3>

                <div className={styles.modalRows}>
                    {productRows.map((row, index) => {
                        const suggestions = filteredCatalog(productCatalog, row.name);
                        const showSave =
                            !catalogExistsByName(productCatalog, row.name) && row.name.trim();

                        return (
                            <div key={index} className={styles.modalRow}>
                                <div className={styles.modalRowHeader}>
                                    <strong>Produto {index + 1}</strong>
                                    <button
                                        type='button'
                                        className={styles.iconBtnDanger}
                                        onClick={() =>
                                            onRowsChange(productRows.filter((_, i) => i !== index))
                                        }
                                        disabled={saving || productRows.length === 1}
                                    >
                                        Remover
                                    </button>
                                </div>

                                <div className={styles.formGrid}>
                                    <label className={styles.label}>
                                        Nome
                                        <div className={styles.autocompleteWrap}>
                                            <input
                                                className={styles.input}
                                                value={row.name}
                                                onFocus={() => setOpenDropdownIndex(index)}
                                                onBlur={() =>
                                                    window.setTimeout(() => {
                                                        setOpenDropdownIndex(current =>
                                                            current === index ? null : current,
                                                        );
                                                    }, 160)
                                                }
                                                onChange={event => {
                                                    updateRow(index, { name: event.target.value });
                                                    setOpenDropdownIndex(index);
                                                }}
                                                disabled={saving}
                                                autoComplete='off'
                                                placeholder='Ex.: Botox'
                                            />
                                            {openDropdownIndex === index && (
                                                <div className={styles.autocompleteList}>
                                                    {suggestions.length === 0 ? (
                                                        <div className={styles.autocompleteEmpty}>
                                                            Nenhum produto encontrado.
                                                        </div>
                                                    ) : (
                                                        suggestions.map(item => (
                                                            <button
                                                                key={item.name}
                                                                type='button'
                                                                className={styles.autocompleteItem}
                                                                onMouseDown={event =>
                                                                    event.preventDefault()
                                                                }
                                                                onClick={() => {
                                                                    updateRow(index, {
                                                                        name: item.name,
                                                                        ...(item.last_value != null && {
                                                                            value: toInputAmount(
                                                                                item.last_value,
                                                                            ),
                                                                        }),
                                                                    });
                                                                    setOpenDropdownIndex(null);
                                                                }}
                                                            >
                                                                {item.name}
                                                                {item.last_value != null && (
                                                                    <span
                                                                        className={
                                                                            styles.autocompleteHint
                                                                        }
                                                                    >
                                                                        {' '}
                                                                        R${' '}
                                                                        {toInputAmount(item.last_value)}
                                                                    </span>
                                                                )}
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {showSave && (
                                            <button
                                                type='button'
                                                className={styles.saveSuggestionBtn}
                                                onMouseDown={event => event.preventDefault()}
                                                onClick={() => onSaveSuggestion(index)}
                                                disabled={saving || savingSuggestionIndex === index}
                                            >
                                                {savingSuggestionIndex === index
                                                    ? 'Salvando...'
                                                    : `✓ Salvar "${row.name.trim()}" no catálogo`}
                                            </button>
                                        )}
                                    </label>

                                    <label className={styles.label}>
                                        Valor (R$)
                                        <input
                                            className={styles.input}
                                            inputMode='decimal'
                                            value={row.value}
                                            placeholder='0,00'
                                            onChange={event =>
                                                updateRow(index, { value: event.target.value })
                                            }
                                            onBlur={event =>
                                                updateRow(index, {
                                                    value: normalizeMoneyInput(event.target.value),
                                                })
                                            }
                                            disabled={saving}
                                        />
                                    </label>

                                    <label className={styles.labelWide}>
                                        Observações
                                        <textarea
                                            className={styles.textarea}
                                            rows={3}
                                            value={row.notes}
                                            onChange={event =>
                                                updateRow(index, { notes: event.target.value })
                                            }
                                            disabled={saving}
                                        />
                                    </label>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className={styles.modalActions}>
                    <button
                        type='button'
                        className={styles.btn}
                        onClick={() =>
                            onRowsChange([...productRows, { name: '', value: '', notes: '' }])
                        }
                        disabled={saving}
                    >
                        + Produto
                    </button>
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
                        {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
