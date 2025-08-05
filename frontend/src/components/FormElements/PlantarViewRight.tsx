import { useState, useEffect } from 'react';
import styles from './MedicalHistoryField.module.css';

const OPTIONS = [
    'Calosidade',
    'Fissura',
    'Hiperqueratose',
    'Úlcera',
    'Micoses',
    'Verruga',
    'Outros',
];

export interface PlantarViewRightProps {
    value: string;
    onChange: (value: string) => void;
}

export default function PlantarViewRight({
    value,
    onChange,
}: PlantarViewRightProps) {
    // Parse value into checked and otherInput
    const [checked, setChecked] = useState<string[]>([]);
    const [otherInput, setOtherInput] = useState('');

    useEffect(() => {
        const items = value ? value.split(',').map(v => v.trim()) : [];
        const checks = items.filter(item => !item.startsWith('Outros:'));
        const outros = items.find(item => item.startsWith('Outros:'));
        setChecked(checks.filter(opt => OPTIONS.includes(opt)));
        setOtherInput(outros ? outros.replace('Outros: ', '') : '');
    }, [value]);

    useEffect(() => {
        let arr = [...checked];
        if (checked.includes('Outros') && otherInput.trim()) {
            arr = arr.filter(opt => opt !== 'Outros');
            arr.push(`Outros: ${otherInput.trim()}`);
        }
        onChange(arr.join(', '));
        // eslint-disable-next-line
    }, [checked, otherInput]);

    const handleCheckboxChange = (option: string) => {
        setChecked(prev =>
            prev.includes(option)
                ? prev.filter(item => item !== option)
                : [...prev, option],
        );
    };

    return (
        <div className={styles.container}>
            <div className={styles.checkboxGroup}>
                {OPTIONS.map(opt => (
                    <label key={opt} className={styles.checkboxLabel}>
                        <input
                            type='checkbox'
                            value={opt}
                            checked={checked.includes(opt)}
                            onChange={() => handleCheckboxChange(opt)}
                        />
                        {` ${opt}`}
                    </label>
                ))}
                {checked.includes('Outros') && (
                    <input
                        type='text'
                        placeholder='Descreva outros...'
                        className={styles.otherInput}
                        value={otherInput}
                        onChange={e => setOtherInput(e.target.value)}
                    />
                )}
            </div>
        </div>
    );
}
