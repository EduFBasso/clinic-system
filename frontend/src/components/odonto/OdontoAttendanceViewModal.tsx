import React from 'react';
import { OdontoToothGrid } from '../OdontoToothGrid';
import { eventDateISO, formatDate, formatMoney } from '../../pages/odontoArcadeHelpers';
import type { ProcedureItem, ToothItem } from '../../pages/odontoArcadeHelpers';
import styles from './OdontoAttendanceViewModal.module.css';

type Props = {
    procedure: ProcedureItem | null;
    products: ProcedureItem[];
    tooth: ToothItem | null;
    orderedTeeth: ToothItem[];
    attendanceType: string;
    onClose: () => void;
};

export default function OdontoAttendanceViewModal({
    procedure,
    products,
    tooth,
    orderedTeeth,
    attendanceType,
    onClose,
}: Props) {
    if (!procedure) return null;

    return (
        <div className={styles.overlay} role='presentation' onClick={onClose}>
            <div
                className={styles.modal}
                role='dialog'
                aria-modal='true'
                aria-label='Detalhes do atendimento'
                onClick={event => event.stopPropagation()}
            >
                <div className={styles.header}>
                    <div>
                        <h3 className={styles.title}>Detalhes do atendimento</h3>
                        <p className={styles.type}>{attendanceType}</p>
                    </div>
                    <button
                        type='button'
                        className={styles.closeBtn}
                        onClick={onClose}
                        aria-label='Fechar detalhes do atendimento'
                        title='Fechar'
                    >
                        <svg viewBox='0 0 24 24' aria-hidden='true' className={styles.icon}>
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

                <div className={styles.body}>
                    <div className={styles.section}>
                        <strong className={styles.label}>Servico</strong>
                        <p className={styles.text}>{procedure.name}</p>
                        <p className={styles.textMuted}>
                            {tooth
                                ? `Dente ${tooth.international_number}`
                                : 'Sem dente associado'}
                        </p>
                        {procedure.faces_raw && (
                            <p className={styles.textMuted}>Face: {procedure.faces_raw}</p>
                        )}
                        <p className={styles.textMuted}>
                            Data: {formatDate(eventDateISO(procedure) || '')}
                        </p>
                        <p className={styles.textMuted}>
                            Valor: {formatMoney(procedure.patient_amount)}
                        </p>
                        {procedure.notes && (
                            <p className={styles.textMuted}>Observacao: {procedure.notes}</p>
                        )}
                    </div>

                    <div className={styles.section}>
                        <strong className={styles.label}>Produtos</strong>
                        {products.length === 0 ? (
                            <p className={styles.textMuted}>Nenhum produto vinculado.</p>
                        ) : (
                            <ul className={styles.productList}>
                                {products.map(product => (
                                    <li key={product.id} className={styles.productItem}>
                                        <span>{product.name}</span>
                                        <span>{formatMoney(product.patient_amount)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {tooth && (
                        <div className={styles.section}>
                            <div className={styles.gridWrap}>
                                <OdontoToothGrid
                                    orderedTeeth={orderedTeeth}
                                    selectedToothId={tooth.id}
                                    suppressDateHighlights={false}
                                    activeDateToothIds={new Set<number>([tooth.id])}
                                    onToothClick={() => undefined}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
