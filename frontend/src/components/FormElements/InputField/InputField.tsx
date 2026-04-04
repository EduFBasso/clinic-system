import type { ChangeEvent } from 'react';
import styles from './InputField.module.css';

type Props = {
    label: string;
    name: string;
    value: string;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    type?: string;
    placeholder?: string;
    required?: boolean;
    hint?: string;
    error?: string;
    autoComplete?: string;
};

export default function InputField({
    label,
    name,
    value,
    onChange,
    type = 'text',
    placeholder,
    required,
    hint,
    error,
    autoComplete,
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
            <input
                className={
                    error
                        ? `${styles.input} ${styles.inputError}`
                        : styles.input
                }
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                autoComplete={autoComplete}
            />
            {error ? (
                <span className={styles.error}>{error}</span>
            ) : hint ? (
                <span className={styles.hint}>{hint}</span>
            ) : null}
        </label>
    );
}
