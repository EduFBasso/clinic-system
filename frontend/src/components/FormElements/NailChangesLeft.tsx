// frontend\src\components\FormElements\NailChangesLeft.tsx
import React from 'react';
import styles from './NailChangesLeft.module.css';

interface NailChangesLeftProps {
    value: string;
    onChange: (value: string) => void;
}

const options = [
    'Onicocriptose',
    'Onicólise',
    'Onicogrifose',
    'Onicomicose no hálux',
    'Outros',
];

const NailChangesLeft: React.FC<NailChangesLeftProps> = ({
    value,
    onChange,
}) => {
    const [checked, setChecked] = React.useState<string[]>([]);
    const [outros, setOutros] = React.useState('');

    React.useEffect(() => {
        // Parse value string to checked/outros on mount or value change
        if (!value) {
            setChecked([]);
            setOutros('');
            return;
        }
        const items = value.split(',').map(v => v.trim());
        const checks = items.filter(item => !item.startsWith('Outros:'));
        const outrosItem = items.find(item => item.startsWith('Outros:'));
        if (outrosItem) {
            setChecked([
                ...checks.filter(opt => options.includes(opt)),
                'Outros',
            ]);
            setOutros(outrosItem.replace('Outros: ', ''));
        } else {
            setChecked(checks.filter(opt => options.includes(opt)));
            setOutros('');
        }
    }, [value]);

    React.useEffect(() => {
        let arr = [...checked];
        if (checked.includes('Outros') && outros.trim()) {
            arr = arr.filter(opt => opt !== 'Outros');
            arr.push(`Outros: ${outros.trim()}`);
        }
        const next = arr.join(', ');
        if (next !== value) {
            onChange(next);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [checked, outros, value]);

    const handleCheckbox = (option: string) => {
        setChecked(prev =>
            prev.includes(option)
                ? prev.filter(item => item !== option)
                : [...prev, option],
        );
    };

    return (
        <div className={styles.container}>
            <div className={styles.checkboxGroup}>
                {options.map(option => (
                    <label key={option} className={styles.checkboxLabel}>
                        <input
                            type='checkbox'
                            checked={checked.includes(option)}
                            onChange={() => handleCheckbox(option)}
                        />
                        {option}
                    </label>
                ))}
                {checked.includes('Outros') && (
                    <input
                        type='text'
                        placeholder='Descreva outros...'
                        className={styles.otherInput}
                        value={outros}
                        onChange={e => setOutros(e.target.value)}
                    />
                )}
            </div>
        </div>
    );
};

export default NailChangesLeft;
