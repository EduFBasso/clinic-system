// frontend\src\components\FormElements\InputField.tsx
import styles from './InputField.module.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
}

export default function InputField({ label, ...props }: InputProps) {
    // Garante que value nunca seja null/undefined
    const safeProps = {
        ...props,
        value:
            typeof props.value === 'string' ? props.value : props.value ?? '',
    };
    return (
        <div className={styles.inputGroup}>
            <label className={styles.label}>{label}</label>
            <input className={styles.input} {...safeProps} />
        </div>
    );
}
