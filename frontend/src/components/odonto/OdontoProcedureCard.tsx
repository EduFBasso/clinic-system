import React from 'react';
import type { ProcedureItem, ToothItem } from '../../pages/odontoArcadeHelpers';
import { formatMoney } from '../../pages/odontoArcadeHelpers';
import styles from '../../styles/pages/OdontoArcadeSimplifiedPage.module.css';

type Props = {
    proc: ProcedureItem;
    tooth: ToothItem | null;
    products: ProcedureItem[];
    isExpanded: boolean;
    arcadeLabelByValue: Map<string, string>;
    onToggleDetails: (procId: number) => void;
    onEdit: (proc: ProcedureItem) => void;
    onDelete: (procId: number) => void;
};

function EyeIcon() {
    return (
        <svg viewBox='0 0 24 24' aria-hidden='true' className={styles.actionIcon}>
            <path
                d='M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z'
                fill='none'
                stroke='currentColor'
                strokeWidth='1.8'
                strokeLinecap='round'
                strokeLinejoin='round'
            />
            <circle cx='12' cy='12' r='3.2' fill='none' stroke='currentColor' strokeWidth='1.8' />
        </svg>
    );
}

function PencilIcon() {
    return (
        <svg viewBox='0 0 24 24' aria-hidden='true' className={styles.actionIcon}>
            <path
                d='M3.2 20.8h4.5L19.2 9.3a2.1 2.1 0 0 0 0-3l-1.6-1.6a2.1 2.1 0 0 0-3 0L3.2 16.1v4.7zm11.9-14.9 1.6 1.6-9.2 9.2H5.9v-1.6l9.2-9.2z'
                fill='currentColor'
            />
        </svg>
    );
}

function TrashIcon() {
    return (
        <svg viewBox='0 0 24 24' aria-hidden='true' className={styles.actionIcon}>
            <path
                d='M8.5 3.8A1.8 1.8 0 0 0 6.7 5.6V7H4.4a1 1 0 1 0 0 2h.7l.8 10.3a2.6 2.6 0 0 0 2.6 2.4h7a2.6 2.6 0 0 0 2.6-2.4L18.9 9h.7a1 1 0 1 0 0-2h-2.3V5.6a1.8 1.8 0 0 0-1.8-1.8h-7zm.2 3.2V5.8h6.6V7H8.7zm1.2 4.1a1 1 0 0 1 1 1v5.3a1 1 0 1 1-2 0v-5.3a1 1 0 0 1 1-1zm4.2 0a1 1 0 0 1 1 1v5.3a1 1 0 1 1-2 0v-5.3a1 1 0 0 1 1-1z'
                fill='currentColor'
            />
        </svg>
    );
}

function ItemActions({
    item,
    onEdit,
    onDelete,
}: {
    item: ProcedureItem;
    onEdit: (p: ProcedureItem) => void;
    onDelete: (id: number) => void;
}) {
    return (
        <div className={styles.procIconGroup}>
            <button
                type='button'
                className={`${styles.iconActionBtn} ${styles.iconEdit}`}
                onClick={() => onEdit(item)}
                aria-label='Editar item'
                title='Editar item'
            >
                <PencilIcon />
            </button>
            <button
                type='button'
                className={`${styles.iconActionBtn} ${styles.iconDelete}`}
                onClick={() => onDelete(item.id)}
                aria-label='Apagar item'
                title='Apagar item'
            >
                <TrashIcon />
            </button>
        </div>
    );
}

export default function OdontoProcedureCard({
    proc,
    tooth,
    products,
    isExpanded,
    arcadeLabelByValue,
    onToggleDetails,
    onEdit,
    onDelete,
}: Props) {
    const [expandedProductId, setExpandedProductId] = React.useState<number | null>(null);
    const isProductContainer = products.length > 0;
    const isArcadeItem = !proc.tooth && proc.faces_raw;
    const phaseLabel = isArcadeItem
        ? (arcadeLabelByValue.get(proc.faces_raw || '') ?? proc.faces_raw)
        : proc.faces_raw || '-';

    let cardTitle: string;
    let cardSubtitle: string | null = null;
    if (isProductContainer) {
        cardTitle = 'Produtos';
    } else if (tooth) {
        cardTitle = `Dente ${tooth.international_number}`;
        cardSubtitle = proc.name;
    } else if (isArcadeItem) {
        cardTitle = arcadeLabelByValue.get(proc.faces_raw || '') ?? proc.faces_raw ?? 'Arcada';
        cardSubtitle = proc.name;
    } else {
        cardTitle = 'Outros Tratamentos';
        cardSubtitle = proc.name;
    }

    return (
        <div className={styles.procItem}>
            <div className={styles.procMain}>
                <div className={styles.procInfoBlock}>
                    <div className={styles.procTitleRow}>
                        <strong>{cardTitle}</strong>
                        {!isProductContainer && (
                            <button
                                type='button'
                                className={`${styles.iconActionBtn} ${styles.iconDetail}`}
                                onClick={() => onToggleDetails(proc.id)}
                                aria-label={isExpanded ? 'Ocultar detalhes' : 'Ver detalhes'}
                                title={isExpanded ? 'Ocultar detalhes' : 'Ver detalhes'}
                            >
                                <EyeIcon />
                            </button>
                        )}
                    </div>
                    {cardSubtitle && (
                        <p className={styles.textMuted}>{cardSubtitle}</p>
                    )}
                </div>
                {products.length === 0 && (
                    <div className={styles.procActions}>
                        <span className={styles.value}>{formatMoney(proc.patient_amount)}</span>
                        <ItemActions item={proc} onEdit={onEdit} onDelete={onDelete} />
                    </div>
                )}
            </div>

            {isExpanded && !isProductContainer && (
                <div className={styles.procDetailsBox}>
                    {!isProductContainer && (
                        <>
                            <p className={styles.textMuted}>
                                <strong>Tipo:</strong>{' '}
                                {tooth ? 'Por dente' : isArcadeItem ? 'Arcada' : 'Outros'}
                            </p>
                            <p className={styles.textMuted}>
                                <strong>{isArcadeItem ? 'Arcada:' : 'Fases:'}</strong> {phaseLabel}
                            </p>
                        </>
                    )}
                    {proc.notes && (
                        <p className={styles.textMuted}>
                            <strong>Observações:</strong> {proc.notes}
                        </p>
                    )}
                </div>
            )}

            {products.length > 0 && (
                <div className={styles.productsBlock}>
                    {products.map(product => {
                        const productExpanded = expandedProductId === product.id;
                        return (
                            <div key={product.id} className={styles.productRow}>
                                <div className={styles.procTitleRow}>
                                    <span>{product.name}</span>
                                    {product.notes && (
                                        <button
                                            type='button'
                                            className={`${styles.iconActionBtn} ${styles.iconDetail}`}
                                            onClick={() =>
                                                setExpandedProductId(
                                                    productExpanded ? null : product.id,
                                                )
                                            }
                                            aria-label={productExpanded ? 'Ocultar observações' : 'Ver observações'}
                                            title={productExpanded ? 'Ocultar observações' : 'Ver observações'}
                                        >
                                            <EyeIcon />
                                        </button>
                                    )}
                                </div>
                                {productExpanded && product.notes && (
                                    <div className={styles.procDetailsBox}>
                                        <p className={styles.textMuted}>
                                            <strong>Observações:</strong> {product.notes}
                                        </p>
                                    </div>
                                )}
                                <div className={styles.procActions}>
                                    <span className={styles.value}>
                                        {formatMoney(product.patient_amount)}
                                    </span>
                                    <ItemActions item={product} onEdit={onEdit} onDelete={onDelete} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
