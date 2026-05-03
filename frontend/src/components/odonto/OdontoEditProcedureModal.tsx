import React from 'react';
import type { ProcedureItem } from '../../pages/odontoArcadeHelpers';
import { normalizeMoneyInput } from '../../pages/odontoArcadeHelpers';
import styles from '../../styles/pages/OdontoArcadeSimplifiedPage.module.css';

type Props = {
    procedure: ProcedureItem | null;
    name: string;
    value: string;
    notes: string;
    saving: boolean;
    onNameChange: (value: string) => void;
    onValueChange: (value: string) => void;
    onNotesChange: (value: string) => void;
    onClose: () => void;
    onSave: () => void;
};

export default function OdontoEditProcedureModal({
    procedure,
    name,
    value,
    notes,
    saving,
    onNameChange,
    onValueChange,
    onNotesChange,
    onClose,
    onSave,
}: Props) {
    if (!procedure) return null;

    return (
        <div
            className={styles.modalOverlay}
            role='presentation'
            onClick={onClose}
        >
            <div
                className={styles.modalCard}
                role='dialog'
                onClick={event => event.stopPropagation()}
            >
                <h3 className={styles.sectionTitle}>Editar item</h3>

                <div className={styles.formGrid}>
                    <label className={styles.labelWide}>
                        Tratamento
                        <input
                            className={styles.input}
                            value={name}
                            onChange={event => onNameChange(event.target.value)}
                            disabled={saving}
                        />
                    </label>
                    <label className={styles.label}>
                        Valor (R$)
                        <input
                            className={styles.input}
                            inputMode='decimal'
                            value={value}
                            onChange={event => onValueChange(event.target.value)}
                            onBlur={event => onValueChange(normalizeMoneyInput(event.target.value))}
                            disabled={saving}
                        />
                    </label>
                    <label className={styles.labelWide}>
                        Observações
                        <textarea
                            className={styles.textarea}
                            rows={3}
                            value={notes}
                            onChange={event => onNotesChange(event.target.value)}
                            disabled={saving}
                        />
                    </label>
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
                        {saving ? 'Salvando...' : 'Salvar alterações'}
                    </button>
                </div>
            </div>
        </div>
    );
}
