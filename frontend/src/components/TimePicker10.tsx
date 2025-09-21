import React from 'react';

interface TimePicker10Props {
    label?: string;
    value: string; // formato HH:MM
    onChange: (v: string) => void;
    minHour?: number; // limite inferior (default 6)
    maxHour?: number; // limite superior (default 21)
    disabled?: boolean;
    style?: React.CSSProperties;
    // Novo: passo dos minutos (5,10,15,20,30) e limites precisos HH:MM
    stepMinutes?: 5 | 10 | 15 | 20 | 30;
    minHM?: string; // 'HH:MM' mínimo permitido (prioritário sobre minHour)
    maxHM?: string; // 'HH:MM' máximo permitido (prioritário sobre maxHour)
}

// Garante HH:MM
function normalizeHour(
    v: string,
    minH: number,
    maxH: number,
): [string, string] {
    if (!/^\d{2}:\d{2}$/.test(v)) return [String(minH).padStart(2, '0'), '00'];
    const [hStr, mStr] = v.split(':');
    let h = parseInt(hStr, 10);
    if (Number.isNaN(h)) h = minH;
    h = Math.min(maxH, Math.max(minH, h));
    const rawM = Math.min(59, Math.max(0, parseInt(mStr, 10)));
    return [String(h).padStart(2, '0'), String(rawM).padStart(2, '0')];
}

// hoursOptions será gerado dinamicamente com base em minHour/maxHour

export const TimePicker10: React.FC<TimePicker10Props> = ({
    label,
    value,
    onChange,
    disabled,
    style,
    minHour = 6,
    maxHour = 21,
    stepMinutes = 10,
    minHM,
    maxHM,
}) => {
    if (minHour > maxHour) {
        // garante coerência
        [minHour, maxHour] = [6, 21];
    }
    // Deriva limites de HH:MM se fornecidos
    let minH = minHour;
    let minM = 0;
    let maxH = maxHour;
    let maxM = 59;
    if (minHM && /^\d{2}:\d{2}$/.test(minHM)) {
        const [h, m] = minHM.split(':').map(n => parseInt(n, 10));
        if (!Number.isNaN(h)) minH = h;
        if (!Number.isNaN(m)) minM = Math.min(59, Math.max(0, m));
    }
    if (maxHM && /^\d{2}:\d{2}$/.test(maxHM)) {
        const [h, m] = maxHM.split(':').map(n => parseInt(n, 10));
        if (!Number.isNaN(h)) maxH = h;
        if (!Number.isNaN(m)) maxM = Math.min(59, Math.max(0, m));
    }
    const hoursOptions = React.useMemo(
        () =>
            Array.from({ length: maxH - minH + 1 }, (_, i) =>
                String(minH + i).padStart(2, '0'),
            ),
        [minH, maxH],
    );
    const [hour, minuteRaw] = React.useMemo(
        () => normalizeHour(value, minH, maxH),
        [value, minH, maxH],
    );
    // Gera opções de minuto com step configurável
    const baseMinutes = React.useMemo(() => {
        const opts: string[] = [];
        for (let m = 0; m < 60; m += stepMinutes) {
            opts.push(String(m).padStart(2, '0'));
        }
        return opts;
    }, [stepMinutes]);
    const minute = minuteRaw.padStart(2, '0');
    const minuteOptions = React.useMemo(() => {
        let opts = baseMinutes;
        // Aplica limites por HH:MM quando estiver na borda
        if (hour === String(minH).padStart(2, '0')) {
            opts = opts.filter(m => parseInt(m, 10) >= minM);
        }
        if (hour === String(maxH).padStart(2, '0')) {
            opts = opts.filter(m => parseInt(m, 10) <= maxM);
        }
        // Inclui minuto atual mesmo que fora da grade (para exibir/permitir manter)
        if (!opts.includes(minute))
            opts = [minute, ...opts].filter((v, i, a) => a.indexOf(v) === i);
        return opts;
    }, [baseMinutes, hour, minH, maxH, minM, maxM, minute]);

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
                    {minuteOptions.map(m => (
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
