// frontend\src\components\FormElements\SockUsedField.tsx
import { OptionWithOtherField } from './FootwearUsedField';

const sockOptions = [
    'Térmica',
    'Algodão',
    'Seda',
    'Compressão',
    'Meia-Calça',
    'Lã',
    'Social',
    'Outro',
];

interface SockUsedFieldProps {
    value: string;
    onChange: (value: string) => void;
    titleClassName?: string;
}

export default function SockUsedField({
    value,
    onChange,
    titleClassName,
}: SockUsedFieldProps) {
    return (
        <OptionWithOtherField
            name='sock_used'
            label='Tipo de meia'
            options={sockOptions}
            value={value}
            onChange={onChange}
            placeholder='Digite o tipo de meia'
            titleClassName={titleClassName}
        />
    );
}
