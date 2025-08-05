// frontend\src\components\FormElements\FootwearUsedField.tsx

import { useState, useEffect } from 'react';
import styles from './FootwearUsedField.module.css';
import SectionTitle from './SectionTitle';

interface OptionWithOtherFieldProps {
    name: string;
    label: string;
    options: string[];
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    titleClassName?: string;
}

// Componente reutilizável para opções com campo alternativo
export function OptionWithOtherField({
    name,
    label,
    options,
    value,
    onChange,
    placeholder,
    titleClassName,
}: OptionWithOtherFieldProps) {
    const [isOtherSelected, setIsOtherSelected] = useState(false);

    useEffect(() => {
        setIsOtherSelected(
            value === 'Outro' || (!options.includes(value) && value !== ''),
        );
    }, [value, options]);

    const handleRadioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.value;
        setIsOtherSelected(selected === 'Outro');
        onChange(e);
    };

    const handleOtherInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e);
    };

    return (
        <div className={styles.container}>
            <SectionTitle className={titleClassName}>{label}</SectionTitle>
            <div className={styles.optionGroup}>
                {options.map(option => (
                    <label key={option} className='flex items-center space-x-2'>
                        <input
                            type='radio'
                            name={name}
                            value={option}
                            checked={value === option}
                            onChange={handleRadioChange}
                        />
                        <span>{option}</span>
                    </label>
                ))}
                {isOtherSelected && (
                    <input
                        type='text'
                        name={name}
                        value={options.includes(value) ? '' : value}
                        onChange={handleOtherInputChange}
                        placeholder={placeholder || 'Digite a opção'}
                        className={styles.input}
                    />
                )}
            </div>
        </div>
    );
}

// Componente específico para calçado, usando o reutilizável
const footwearOptions = [
    'Tênis',
    'Sapato baixo',
    'Sapato alto',
    'Sapato bico fino',
    'Sandália',
    'Chinelo',
    'Outro',
];

interface FootwearUsedFieldProps {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    titleClassName?: string;
}

export default function FootwearUsedField({
    value,
    onChange,
    titleClassName,
}: FootwearUsedFieldProps) {
    return (
        <OptionWithOtherField
            name='footwear_used'
            label='Tipo de calçado'
            options={footwearOptions}
            value={value}
            onChange={onChange}
            placeholder='Digite o tipo de calçado'
            titleClassName={titleClassName}
        />
    );
}
