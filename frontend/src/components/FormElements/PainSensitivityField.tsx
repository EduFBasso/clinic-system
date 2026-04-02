// frontend/src/components/FormElements/PainSensitivityField.tsx
import styles from './PainSensitivityField.module.css';
import SectionTitle from './SectionTitle';

interface PainSensitivityFieldProps {
    value: string;
    onChange: (val: string) => void;
}

export default function PainSensitivityField({
    value,
    onChange,
}: PainSensitivityFieldProps) {
    return (
        <div className={styles.container}>
            <SectionTitle>Nível de sensibilidade à dor</SectionTitle>
            <div className={styles.radioGroup}>
                <label>
                    <input
                        type='radio'
                        value='Pouco sensível'
                        checked={value === 'Pouco sensível'}
                        onChange={() => onChange('Pouco sensível')}
                    />
                    {' Pouco sensível'}
                </label>
                <label>
                    <input
                        type='radio'
                        value='Normal'
                        checked={value === 'Normal'}
                        onChange={() => onChange('Normal')}
                    />
                    {' Normal'}
                </label>
                <label>
                    <input
                        type='radio'
                        value='Muito sensível'
                        checked={value === 'Muito sensível'}
                        onChange={() => onChange('Muito sensível')}
                    />
                    {' Muito sensível'}
                </label>
            </div>
        </div>
    );
}
