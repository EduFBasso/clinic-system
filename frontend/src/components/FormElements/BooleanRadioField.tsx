// frontend\src\components\FormElements\BooleanRadioField.tsx
import styles from './BooleanRadioField.module.css';
import SectionTitle from './SectionTitle';

interface BooleanRadioFieldProps {
    label: string;
    value: boolean | null;
    onChange: (val: boolean) => void;
}

export default function BooleanRadioField({
    label,
    value,
    onChange,
}: BooleanRadioFieldProps) {
    return (
        <div className={styles.container}>
            <SectionTitle>{label}</SectionTitle>
            <div className={styles.radioGroup}>
                <label>
                    <input
                        type='radio'
                        checked={value === false}
                        onChange={() => onChange(false)}
                    />
                    {' Não'}
                </label>
                <label>
                    <input
                        type='radio'
                        checked={value === true}
                        onChange={() => onChange(true)}
                    />
                    {' Sim'}
                </label>
            </div>
        </div>
    );
}
