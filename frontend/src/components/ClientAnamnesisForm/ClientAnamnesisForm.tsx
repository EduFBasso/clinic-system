import React from 'react';
import type { AnamnesisField } from '../../types/AnamnesisTypes';
import styles from './ClientAnamnesisForm.module.css';

interface Props {
    fields: AnamnesisField[];
    values: Record<number, string>;
    onChange: (fieldId: number, value: string) => void;
}

export default function ClientAnamnesisForm({
    fields,
    values,
    onChange,
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
                    <span className={styles.eyebrow}>Cadastro</span>
                    <h2 className={styles.title}>Anamnese</h2>
                </header>

                {sectors.map(([sectorName, { fields: sectorFields }]) => (
                    <section key={sectorName} className={styles.sector}>
                        <h3 className={styles.sectorTitle}>{sectorName}</h3>
                        <div className={styles.fieldList}>
                            {sectorFields.map(field => (
                                <div key={field.id} className={styles.fieldRow}>
                                    <span className={styles.fieldLabel}>
                                        {field.label}
                                    </span>

                                    {field.field_type === 'radio' &&
                                        field.options && (
                                            <div className={styles.radioGroup}>
                                                {field.options.map(opt => {
                                                    const selected =
                                                        values[field.id] ===
                                                        opt;
                                                    return (
                                                        <button
                                                            key={opt}
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
                                                })}
                                            </div>
                                        )}

                                    {field.field_type === 'text' && (
                                        <input
                                            type='text'
                                            className={styles.textInput}
                                            value={values[field.id] ?? ''}
                                            onChange={e =>
                                                onChange(
                                                    field.id,
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    )}

                                    {field.field_type === 'textarea' && (
                                        <textarea
                                            className={styles.textarea}
                                            rows={3}
                                            value={values[field.id] ?? ''}
                                            onChange={e =>
                                                onChange(
                                                    field.id,
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}
