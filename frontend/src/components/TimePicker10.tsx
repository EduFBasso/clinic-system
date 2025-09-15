import React from 'react';

interface TimePicker10Props {
    label?: string;
    value: string; // formato HH:MM
    onChange: (v: string) => void;
    minHour?: number; // limite inferior (default 6)
    maxHour?: number; // limite superior (default 21)
    disabled?: boolean;
    style?: React.CSSProperties;
}

// Garante HH:MM
function normalize(v: string, minH: number, maxH: number): string {
    if (!/^\d{2}:\d{2}$/.test(v)) return `${String(minH).padStart(2, '0')}:00`;
    const [hStr, mStr] = v.split(':');
    let h = parseInt(hStr, 10);
    if (Number.isNaN(h)) h = minH;
    h = Math.min(maxH, Math.max(minH, h));
    const rawM = Math.min(59, Math.max(0, parseInt(mStr, 10)));
    const m10 = Math.floor(rawM / 10) * 10;
    return `${String(h).padStart(2, '0')}:${String(m10).padStart(2, '0')}`;
}

const minutesOptions = ['00', '10', '20', '30', '40', '50'];
// hoursOptions será gerado dinamicamente com base em minHour/maxHour

export const TimePicker10: React.FC<TimePicker10Props> = ({
    label,
    value,
    onChange,
    disabled,
    style,
    minHour = 6,
    maxHour = 21,
}) => {
    if (minHour > maxHour) {
        // garante coerência
        [minHour, maxHour] = [6, 21];
    }
    const hoursOptions = React.useMemo(
        () =>
            Array.from({ length: maxHour - minHour + 1 }, (_, i) =>
                String(minHour + i).padStart(2, '0'),
            ),
        [minHour, maxHour],
    );
    const norm = React.useMemo(
        () => normalize(value, minHour, maxHour),
        [value, minHour, maxHour],
    );
    const [hour, minute] = norm.split(':');

    function handleHourChange(e: React.ChangeEvent<HTMLSelectElement>) {
        onChange(`${e.target.value}:${minute}`);
    }
    function handleMinuteChange(e: React.ChangeEvent<HTMLSelectElement>) {
        onChange(`${hour}:${e.target.value}`);
    }

    return (
        <label style={{ display: 'flex', flexDirection: 'column', ...style }}>
            {label && (
                <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
            )}
            <div style={{ display: 'flex', gap: 4 }}>
                <select
                    value={hour}
                    onChange={handleHourChange}
                    disabled={disabled}
                    style={{ padding: '6px 8px' }}
                >
                    {hoursOptions.map(h => (
                        <option key={h} value={h}>
                            {h}
                        </option>
                    ))}
                </select>
                <span style={{ alignSelf: 'center', fontWeight: 600 }}>:</span>
                <select
                    value={minute}
                    onChange={handleMinuteChange}
                    disabled={disabled}
                    style={{ padding: '6px 8px' }}
                >
                    {minutesOptions.map(m => (
                        <option key={m} value={m}>
                            {m}
                        </option>
                    ))}
                </select>
            </div>
        </label>
    );
};

export default TimePicker10;
