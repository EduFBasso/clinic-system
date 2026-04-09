import type { ChangeEvent } from 'react';
import styles from './SelectField.module.css';

type Option = { value: string; label: string };

type Props = {
    label: string;
    name: string;
    value: string;
    onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
    options: Option[];
    placeholder?: string;
    required?: boolean;
    hint?: string;
    error?: string;
};

export default function SelectField({
    label,
    name,
    value,
    onChange,
    options,
    placeholder,
    required,
    hint,
    error,
}: Props) {
    return (
        <label className={styles.field}>
            <span className={styles.label}>
                {label}
                {required && (
                    <span className={styles.req} aria-hidden='true'>
                        {' '}
                        *
                    </span>
                )}
            </span>
            <select
                className={
                    error
                        ? `${styles.input} ${styles.inputError}`
                        : styles.input
                }
                name={name}
                value={value}
                onChange={onChange}
            >
                <option value=''>{placeholder ?? 'Selecione…'}</option>
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
            {error ? (
                <span className={styles.error}>{error}</span>
            ) : hint ? (
                <span className={styles.hint}>{hint}</span>
            ) : null}
        </label>
    );
}
