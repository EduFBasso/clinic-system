// frontend\src\components\FormElements\FootwearUsedField.tsx
import styles from './FootwearUsedField.module.css';
import SectionTitle from './SectionTitle';

interface OptionWithOtherFieldProps {
    name: string;
    label: string;
    options: string[];
    value: string;
    onChange: (value: string) => void;
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
    const handleRadioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.value;
        if (selected === 'Outro') {
            onChange('Outro');
        } else {
            onChange(selected);
        }
    };

    const handleOtherInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(`Calçado: ${e.target.value}`);
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
                            checked={
                                option === 'Outro'
                                    ? value === 'Outro' ||
                                      value.startsWith('Calçado: ')
                                    : value === option
                            }
                            onChange={handleRadioChange}
                        />
                        <span>{option}</span>
                    </label>
                ))}
                {(value === 'Outro' || value.startsWith('Calçado: ')) && (
                    <input
                        type='text'
                        name={name}
                        value={
                            value.startsWith('Calçado: ') ? value.slice(9) : ''
                        }
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
    onChange: (value: string) => void;
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
