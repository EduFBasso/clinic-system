// frontend\src\components\FormElements\SensitivityTest.tsx
import React from 'react';
import styles from './SensitivityTest.module.css';

interface SensitivityTestProps {
    value: string;
    onChange: (value: string) => void;
}

const options = ['Preservada', 'Reduzida', 'Ausente'];

const SensitivityTest: React.FC<SensitivityTestProps> = ({
    value,
    onChange,
}) => {
    return (
        <div className={styles.sensitivityTestGroup}>
            {options.map(option => (
                <label key={option} className={styles.radioLabel}>
                    <input
                        type='radio'
                        name='sensitivity_test'
                        value={option}
                        checked={value === option}
                        onChange={() => onChange(option)}
                        className={styles.radioInput}
                    />
                    <span className={styles.customRadio}></span>
                    {option}
                </label>
            ))}
        </div>
    );
};

export default SensitivityTest;
