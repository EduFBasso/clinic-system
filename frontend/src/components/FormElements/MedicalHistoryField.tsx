// frontend\src\components\FormElements\MedicalHistoryField.tsx
import { useState, useEffect, useRef } from 'react';
import styles from './MedicalHistoryField.module.css';
import SectionTitle from './SectionTitle';

const OPTIONS = [
    'Marca Passos',
    'Pinos',
    'Pressão Alta',
    'Convulsões',
    'Antecedentes Cancerígenos',
    'Diabete',
    'Problema Cardiorrespiratório',
    'Outros',
];

interface MedicalHistoryFieldProps {
    value: string;
    onChange: (value: string) => void;
}

export default function MedicalHistoryField({
    value,
    onChange,
}: MedicalHistoryFieldProps) {
    const [selected, setSelected] = useState<string[]>([]);
    const [otherInput, setOtherInput] = useState('');
    const prevValue = useRef('');

    // Sincroniza o valor inicial apenas na montagem
    useEffect(() => {
        if (value && prevValue.current !== value) {
            const items = value.split(',').map(v => v.trim());
            setSelected(
                items.filter(
                    item => OPTIONS.includes(item) || item.startsWith('Outros'),
                ),
            );
            const outros = items.find(item => item.startsWith('Outros: '));
            setOtherInput(outros ? outros.replace('Outros: ', '') : '');
            prevValue.current = value;
        }
        // eslint-disable-next-line
    }, []);

    useEffect(() => {
        const values = [...selected].filter(v => !v.startsWith('Outros:'));
        if (selected.includes('Outros') && otherInput.trim()) {
            values.push(`Outros: ${otherInput.trim()}`);
        }
        const newValue = values.join(', ');
        if (newValue !== value) {
            onChange(newValue);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected, otherInput, value]);

    const handleCheckboxChange = (option: string) => {
        setSelected(prev =>
            prev.includes(option)
                ? prev.filter(item => item !== option)
                : [...prev, option],
        );
    };

    return (
        <div className={styles.container}>
            <SectionTitle>Comorbidades pré-existentes</SectionTitle>
            <div className={styles.checkboxGroup}>
                {OPTIONS.map(opt => (
                    <label key={opt} className={styles.checkboxLabel}>
                        <input
                            type='checkbox'
                            value={opt}
                            checked={selected.includes(opt)}
                            onChange={() => handleCheckboxChange(opt)}
                        />
                        {` ${opt}`}
                    </label>
                ))}
                {selected.includes('Outros') && (
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
