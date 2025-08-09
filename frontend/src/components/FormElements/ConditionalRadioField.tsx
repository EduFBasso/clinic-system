// frontend/src/components/FormElements/ConditionalRadioField.tsx
import React from 'react';
import styles from './ConditionalRadioField.module.css';
import SectionTitle from './SectionTitle';

interface ConditionalRadioFieldProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    className?: string;
}

export default function ConditionalRadioField({
    label,
    value,
    onChange,
    className,
}: ConditionalRadioFieldProps) {
    const isYes = value.startsWith('Sim: ');
    const explanation = isYes ? value.slice(5) : '';

    const handleRadioChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedValue = event.target.value;
        if (selectedValue === 'Não') {
            onChange('Não');
        } else {
            onChange('Sim: ');
        }
    };

    const handleExplanationChange = (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        onChange(`Sim: ${event.target.value}`);
    };

    return (
        <div className={`${styles.fieldContainer} ${className || ''}`}>
            <SectionTitle>{label}</SectionTitle>

            <div className={styles.radioGroup}>
                <label>
                    <input
                        type='radio'
                        value='Não'
                        checked={value === 'Não'}
                        onChange={handleRadioChange}
                    />
                    {' Não'}
                </label>

                <label>
                    <input
                        type='radio'
                        value='Sim'
                        checked={isYes}
                        onChange={handleRadioChange}
                    />
                    {' Sim'}
                </label>
            </div>

            {isYes && (
                <input
                    type='text'
                    className={styles.textInput}
                    placeholder='Descrição da atividade'
                    value={explanation}
                    onChange={handleExplanationChange}
                />
            )}
        </div>
    );
}
