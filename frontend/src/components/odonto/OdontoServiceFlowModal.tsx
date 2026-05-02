import React from 'react';
import type { ToothItem } from '../../pages/odontoArcadeHelpers';
import styles from '../../styles/pages/OdontoArcadePage.module.css';

type ServiceFlowType = 'tooth' | 'arcade' | 'other';

type ServiceRow = {
    toothId: number | null;
    name: string;
    value: string;
};

type Props = {
    open: boolean;
    saving: boolean;
    flowType: ServiceFlowType;
    rows: ServiceRow[];
    orderedTeeth: ToothItem[];
    defaultToothId: number | null;
    onClose: () => void;
    onSave: () => void;
    onFlowTypeChange: (flowType: ServiceFlowType) => void;
    onRowsChange: (rows: ServiceRow[]) => void;
};

export default function OdontoServiceFlowModal({
    open,
    saving,
    flowType,
    rows,
    orderedTeeth,
    defaultToothId,
    onClose,
    onSave,
    onFlowTypeChange,
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
                aria-label='Novo servico'
                onClick={event => event.stopPropagation()}
            >
                <div className={styles.serviceFlowHeader}>
                    <div className={styles.serviceFlowHeaderMain}>
                        <h3 className={styles.sectionTitle}>Novo servico</h3>
                        <div className={styles.serviceFlowStepChoices}>
                            <button
                                type='button'
                                className={`${styles.serviceFlowChoiceBtn} ${
                                    flowType === 'tooth'
                                        ? styles.serviceFlowChoiceBtnActive
                                        : ''
                                }`}
                                onClick={() => onFlowTypeChange('tooth')}
                                disabled={saving}
                            >
                                Por dente
                            </button>
                            <button
                                type='button'
                                className={`${styles.serviceFlowChoiceBtn} ${
                                    flowType === 'arcade'
                                        ? styles.serviceFlowChoiceBtnActive
                                        : ''
                                }`}
                                onClick={() => onFlowTypeChange('arcade')}
                                disabled={saving}
                            >
                                Arcada
                            </button>
                            <button
                                type='button'
                                className={`${styles.serviceFlowChoiceBtn} ${
                                    flowType === 'other'
                                        ? styles.serviceFlowChoiceBtnActive
                                        : ''
                                }`}
                                onClick={() => onFlowTypeChange('other')}
                                disabled={saving}
                            >
                                Outro
                            </button>
                        </div>
                    </div>
                </div>

                <div className={styles.serviceFlowBody}>
                    <div className={styles.productFlowTopActions}>
                        <button
                            type='button'
                            className={styles.btnPrimary}
                            onClick={() =>
                                onRowsChange([
                                    ...rows,
                                    {
                                        toothId: defaultToothId,
                                        name: '',
                                        value: '',
                                    },
                                ])
                            }
                            disabled={saving}
                        >
                            + Linha
                        </button>
                    </div>

                    <div className={styles.serviceFlowRows}>
                        {rows.map((row, index) => (
                            <div key={index} className={styles.serviceFlowRow}>
                                <div className={styles.productFlowRowHeader}>
                                    <strong>Linha {index + 1}</strong>
                                    <button
                                        type='button'
                                        className={styles.iconBtnDanger}
                                        onClick={() =>
                                            onRowsChange(
                                                rows.filter((_, i) => i !== index),
                                            )
                                        }
                                        disabled={saving || rows.length === 1}
                                        title='Remover linha'
                                        aria-label='Remover linha'
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

                                {flowType === 'tooth' && (
                                    <label className={styles.formLabel}>
                                        Dente
                                        <select
                                            className={styles.input}
                                            value={row.toothId ?? ''}
                                            onChange={event =>
                                                onRowsChange(
                                                    rows.map((item, i) =>
                                                        i === index
                                                            ? {
                                                                  ...item,
                                                                  toothId: event.target
                                                                      .value
                                                                      ? Number(
                                                                            event.target
                                                                                .value,
                                                                        )
                                                                      : null,
                                                              }
                                                            : item,
                                                    ),
                                                )
                                            }
                                            disabled={saving}
                                        >
                                            <option value=''>Selecione</option>
                                            {orderedTeeth.map(tooth => (
                                                <option
                                                    key={tooth.id}
                                                    value={tooth.id}
                                                >
                                                    Dente {tooth.international_number}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                )}

                                <div className={styles.formGrid}>
                                    <label className={styles.formLabel}>
                                        Nome do procedimento *
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
                                            value={row.value}
                                            placeholder='0,00'
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
                        {saving ? 'Salvando...' : 'Salvar servicos'}
                    </button>
                </div>
            </div>
        </div>
    );
}
