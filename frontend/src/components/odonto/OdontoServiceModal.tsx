import React from 'react';
import { OdontoToothGrid } from '../OdontoToothGrid';
import type { ServiceFlowType, ServiceRow, ToothItem } from '../../pages/odontoArcadeHelpers';
import {
    ARCADE_OPTIONS,
    PHASE_OPTIONS,
    normalizeMoneyInput,
    normalizeSearchText,
} from '../../pages/odontoArcadeHelpers';
import styles from '../../styles/pages/OdontoArcadeSimplifiedPage.module.css';

type Props = {
    open: boolean;
    saving: boolean;
    flowType: ServiceFlowType;
    serviceRows: ServiceRow[];
    orderedTeeth: ToothItem[];
    toothById: Map<number, ToothItem>;
    procedureNames: string[];
    savingSuggestionIndex: number | null;
    onClose: () => void;
    onSave: () => void;
    onFlowTypeChange: (type: ServiceFlowType) => void;
    onUpdateRow: (index: number, patch: Partial<ServiceRow>) => void;
    onToggleToothRow: (toothId: number) => void;
    onAddItem: () => void;
    onSaveSuggestion: (index: number) => void;
};

function filteredProcedureNames(procedureNames: string[], searchRaw: string): string[] {
    const sorted = [...procedureNames].sort((a, b) =>
        a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }),
    );
    const search = normalizeSearchText(searchRaw);
    if (!search) return sorted.slice(0, 24);

    return sorted
        .filter(name => normalizeSearchText(name).includes(search))
        .sort((a, b) => {
            const aN = normalizeSearchText(a);
            const bN = normalizeSearchText(b);
            const aStarts = aN.startsWith(search) ? 0 : 1;
            const bStarts = bN.startsWith(search) ? 0 : 1;
            if (aStarts !== bStarts) return aStarts - bStarts;
            const aIndex = aN.indexOf(search);
            const bIndex = bN.indexOf(search);
            if (aIndex !== bIndex) return aIndex - bIndex;
            return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
        })
        .slice(0, 24);
}

function treatmentExistsInSuggestions(procedureNames: string[], treatmentRaw: string): boolean {
    const normalized = treatmentRaw.trim().toLowerCase();
    if (!normalized) return false;
    return procedureNames.some(name => name.trim().toLowerCase() === normalized);
}

export default function OdontoServiceModal({
    open,
    saving,
    flowType,
    serviceRows,
    orderedTeeth,
    toothById,
    procedureNames,
    savingSuggestionIndex,
    onClose,
    onSave,
    onFlowTypeChange,
    onUpdateRow,
    onToggleToothRow,
    onAddItem,
    onSaveSuggestion,
}: Props) {
    const [openDropdownIndex, setOpenDropdownIndex] = React.useState<number | null>(null);

    if (!open) return null;

    const selectedToothIds = new Set(
        serviceRows.map(row => row.toothId).filter((id): id is number => id != null),
    );

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
                <h3 className={styles.sectionTitle}>Novo servico</h3>

                <div className={styles.typeTabs}>
                    {(['tooth', 'arcade', 'other'] as ServiceFlowType[]).map(type => (
                        <button
                            key={type}
                            type='button'
                            onClick={() => onFlowTypeChange(type)}
                            className={`${styles.tabBtn} ${flowType === type ? styles.tabActive : ''}`}
                            disabled={saving}
                        >
                            {type === 'tooth' ? 'Por dente' : type === 'arcade' ? 'Arcada' : 'Outros'}
                        </button>
                    ))}
                </div>

                {flowType === 'tooth' && (
                    <div className={styles.modalToothSelector}>
                        <OdontoToothGrid
                            orderedTeeth={orderedTeeth}
                            selectedToothId={null}
                            suppressDateHighlights={false}
                            activeDateToothIds={selectedToothIds}
                            onToothClick={onToggleToothRow}
                        />
                    </div>
                )}

                {flowType === 'tooth' && serviceRows.length === 0 && (
                    <p className={styles.textMuted}>
                        Toque nos dentes do mapa para adicionar os containers do servico.
                    </p>
                )}

                <div className={styles.modalRows}>
                    {serviceRows.map((row, index) => {
                        const suggestions = filteredProcedureNames(procedureNames, row.treatment);
                        const showSave =
                            !treatmentExistsInSuggestions(procedureNames, row.treatment) &&
                            row.treatment.trim();

                        return (
                            <div key={index} className={styles.modalRow}>
                                <div className={styles.modalRowHeader}>
                                    <strong>
                                        {row.toothId != null
                                            ? `Dente ${toothById.get(row.toothId)?.international_number ?? row.toothId}`
                                            : `Item ${index + 1}`}
                                    </strong>
                                    {(flowType === 'tooth' || flowType === 'arcade') && (
                                        <label className={styles.phaseInlineLabel}>
                                            {flowType === 'arcade' ? 'Arcada' : 'Faces (opcional)'}
                                            <select
                                                className={`${styles.input} ${styles.phaseSelect}`}
                                                value={row.phase}
                                                onChange={event =>
                                                    onUpdateRow(index, { phase: event.target.value })
                                                }
                                                disabled={saving}
                                            >
                                                {(flowType === 'arcade' ? ARCADE_OPTIONS : PHASE_OPTIONS).map(
                                                    option => (
                                                        <option
                                                            key={option.value || 'empty'}
                                                            value={option.value}
                                                        >
                                                            {flowType === 'arcade'
                                                                ? option.label
                                                                : option.value
                                                                  ? `${option.value} - ${option.label}`
                                                                  : option.label}
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                        </label>
                                    )}
                                </div>

                                <div className={styles.formGrid}>
                                    <label className={styles.label}>
                                        Tratamento
                                        <div className={styles.autocompleteWrap}>
                                            <input
                                                className={styles.input}
                                                value={row.treatment}
                                                onFocus={() => setOpenDropdownIndex(index)}
                                                onBlur={() =>
                                                    window.setTimeout(() => {
                                                        setOpenDropdownIndex(current =>
                                                            current === index ? null : current,
                                                        );
                                                    }, 160)
                                                }
                                                onChange={event => {
                                                    onUpdateRow(index, { treatment: event.target.value });
                                                    setOpenDropdownIndex(index);
                                                }}
                                                disabled={saving}
                                                autoComplete='off'
                                                placeholder='Ex.: Restauracao em resina'
                                            />
                                            {openDropdownIndex === index && (
                                                <div className={styles.autocompleteList}>
                                                    {suggestions.length === 0 ? (
                                                        <div className={styles.autocompleteEmpty}>
                                                            Nenhuma sugestao encontrada.
                                                        </div>
                                                    ) : (
                                                        suggestions.map(name => (
                                                            <button
                                                                key={name}
                                                                type='button'
                                                                className={styles.autocompleteItem}
                                                                onMouseDown={event =>
                                                                    event.preventDefault()
                                                                }
                                                                onClick={() => {
                                                                    onUpdateRow(index, { treatment: name });
                                                                    setOpenDropdownIndex(null);
                                                                }}
                                                            >
                                                                {name}
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
                                                    : `✓ Salvar "${row.treatment.trim()}" na lista`}
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
                                                onUpdateRow(index, { value: event.target.value })
                                            }
                                            onBlur={event =>
                                                onUpdateRow(index, {
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
                                                onUpdateRow(index, { notes: event.target.value })
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
                    {flowType !== 'tooth' && (
                        <button
                            type='button'
                            className={styles.btn}
                            onClick={onAddItem}
                            disabled={saving}
                        >
                            + Item
                        </button>
                    )}
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
