import React from 'react';
import type { AnamnesisField } from '../../types/AnamnesisTypes';
import styles from './ClientAnamnesisForm.module.css';

interface Props {
    fields: AnamnesisField[];
    values: Record<number, string>;
    onChange: (fieldId: number, value: string) => void;
    isEdit?: boolean;
}

export default function ClientAnamnesisForm({
    fields,
    values,
    onChange,
    isEdit = false,
}: Props) {
    if (fields.length === 0) return null;

    // Group fields by sector, preserving sector_order
    const sectorMap = new Map<
        string,
        { order: number; fields: AnamnesisField[] }
    >();
    for (const f of fields) {
        if (!sectorMap.has(f.sector)) {
            sectorMap.set(f.sector, { order: f.sector_order, fields: [] });
        }
        sectorMap.get(f.sector)!.fields.push(f);
    }
    const sectors = Array.from(sectorMap.entries()).sort(
        (a, b) => a[1].order - b[1].order,
    );

    return (
        <div data-theme='blue' className={styles.wrapper}>
            <div className={styles.form}>
                <header className={styles.header}>
                    <span className={styles.eyebrow}>
                        {isEdit ? 'Editar / Apagar' : 'Cadastro'}
                    </span>
                    <h2 className={styles.title}>Anamnese</h2>
                </header>

                {sectors.map(([sectorName, { fields: sectorFields }]) => {
                    // Build companion map: for a radio "Toma medicação" field,
                    // find a sibling text field "Qual medicação?" and show it
                    // only when the radio value is "Sim".
                    const companionMap = new Map<number, AnamnesisField>();
                    const companionFieldIds = new Set<number>();
                    for (const f of sectorFields) {
                        if (
                            f.field_type === 'radio' &&
                            /medica[çc]/i.test(f.label)
                        ) {
                            const companion = sectorFields.find(
                                sf =>
                                    sf.field_type === 'text' &&
                                    /qual.*medic/i.test(sf.label),
                            );
                            if (companion) {
                                companionMap.set(f.id, companion);
                                companionFieldIds.add(companion.id);
                            }
                        }
                    }

                    return (
                        <section key={sectorName} className={styles.sector}>
                            <h3 className={styles.sectorTitle}>{sectorName}</h3>
                            <div className={styles.fieldList}>
                                {sectorFields.map(field => {
                                    // Companion fields render inline below their parent
                                    if (companionFieldIds.has(field.id))
                                        return null;

                                    const companion = companionMap.get(
                                        field.id,
                                    );
                                    const showCompanion =
                                        !!companion &&
                                        values[field.id] === 'Sim';

                                    return (
                                        <div
                                            key={field.id}
                                            className={styles.fieldRow}
                                        >
                                            <span className={styles.fieldLabel}>
                                                {field.label}
                                            </span>

                                            {field.field_type === 'radio' &&
                                                field.options && (
                                                    <div
                                                        className={
                                                            styles.radioGroup
                                                        }
                                                    >
                                                        {field.options.map(
                                                            opt => {
                                                                const selected =
                                                                    values[
                                                                        field.id
                                                                    ] === opt;
                                                                return (
                                                                    <button
                                                                        key={
                                                                            opt
                                                                        }
                                                                        type='button'
                                                                        data-anamnesis-pill=''
                                                                        data-selected={
                                                                            selected
                                                                                ? ''
                                                                                : undefined
                                                                        }
                                                                        className={
                                                                            selected
                                                                                ? `${styles.radioBtn} ${styles.radioBtnSelected}`
                                                                                : styles.radioBtn
                                                                        }
                                                                        onClick={() =>
                                                                            onChange(
                                                                                field.id,
                                                                                selected
                                                                                    ? ''
                                                                                    : opt,
                                                                            )
                                                                        }
                                                                    >
                                                                        {opt}
                                                                    </button>
                                                                );
                                                            },
                                                        )}
                                                    </div>
                                                )}

                                            {showCompanion && companion && (
                                                <div
                                                    className={styles.fieldRow}
                                                    style={{ marginTop: 4 }}
                                                >
                                                    <span
                                                        className={
                                                            styles.fieldLabel
                                                        }
                                                    >
                                                        {companion.label}
                                                    </span>
                                                    <input
                                                        type='text'
                                                        className={
                                                            styles.textInput
                                                        }
                                                        value={
                                                            values[
                                                                companion.id
                                                            ] ?? ''
                                                        }
                                                        placeholder='Informe a medicação...'
                                                        onChange={e =>
                                                            onChange(
                                                                companion.id,
                                                                e.target.value,
                                                            )
                                                        }
                                                    />
                                                </div>
                                            )}

                                            {field.field_type === 'text' && (
                                                <input
                                                    type='text'
                                                    className={styles.textInput}
                                                    value={
                                                        values[field.id] ?? ''
                                                    }
                                                    onChange={e =>
                                                        onChange(
                                                            field.id,
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                            )}

                                            {field.field_type ===
                                                'textarea' && (
                                                <textarea
                                                    className={styles.textarea}
                                                    rows={3}
                                                    value={
                                                        values[field.id] ?? ''
                                                    }
                                                    onChange={e =>
                                                        onChange(
                                                            field.id,
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    );
                })}
            </div>
        </div>
    );
}
