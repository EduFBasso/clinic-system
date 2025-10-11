import React from 'react';
import formStyles from '../../styles/pages/Client.module.css';

interface Props {
    saving?: boolean;
    onCancel?: () => void;
}

export default function FormActions({ saving, onCancel }: Props) {
    return (
        <div className={formStyles.formActions}>
            <button
                type='button'
                className={formStyles['btn-cancel']}
                onClick={onCancel}
            >
                Cancelar
            </button>
            <button
                type='submit'
                className={formStyles['btn-save']}
                disabled={!!saving}
            >
                {saving ? 'Salvando…' : 'Salvar'}
            </button>
        </div>
    );
}
