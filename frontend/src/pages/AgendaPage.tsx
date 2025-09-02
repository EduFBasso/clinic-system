import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE } from '../config/api';

function parseDateParam(s?: string | null) {
    if (!s) return new Date();
    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(s);
    if (!m) return new Date();
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
function toISODate(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

export default function AgendaPage() {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const [date, setDate] = useState<Date>(() =>
        parseDateParam(params.get('date')),
    );
    const [startHour, setStartHour] = useState<number>(() => {
        const v = localStorage.getItem('agenda.startHour');
        return v ? Number(v) : 8;
    });
    const [endHour, setEndHour] = useState<number>(() => {
        const v = localStorage.getItem('agenda.endHour');
        return v ? Number(v) : 18;
    });
    const [stepMin, setStepMin] = useState<number>(() => {
        const v = localStorage.getItem('agenda.stepMin');
        return v ? Number(v) : 30;
    });

    useEffect(() => {
        const token = localStorage.getItem('accessToken');
        if (!token) return;
        const fetchSettings = () =>
            fetch(`${API_BASE}/register/professionals/settings/`, {
                headers: { Authorization: `Bearer ${token}` },
            })
                .then(r => (r.ok ? r.json() : null))
                .then(data => {
                    if (!data) return;
                    if (typeof data.work_start_hour === 'number') {
                        setStartHour(data.work_start_hour);
                        localStorage.setItem(
                            'agenda.startHour',
                            String(data.work_start_hour),
                        );
                    }
                    if (typeof data.work_end_hour === 'number') {
                        setEndHour(data.work_end_hour);
                        localStorage.setItem(
                            'agenda.endHour',
                            String(data.work_end_hour),
                        );
                    }
                    if (typeof data.slot_minutes === 'number') {
                        setStepMin(data.slot_minutes);
                        localStorage.setItem(
                            'agenda.stepMin',
                            String(data.slot_minutes),
                        );
                    }
                })
                .catch(() => void 0);
        fetchSettings();
        const onFocus = () => fetchSettings();
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
        // mount + on focus
    }, []);

    function fmtHour(h: number) {
        const hh = String(Math.max(0, Math.min(23, Math.floor(h)))).padStart(
            2,
            '0',
        );
        return `${hh}:00`;
    }

    // Helpers para menus Início/Fim
    const timeOptions = useMemo(() => {
        const opts: string[] = [];
        const start = new Date(date);
        start.setHours(startHour, 0, 0, 0);
        const end = new Date(date);
        end.setHours(endHour, 0, 0, 0);
        for (
            let t = new Date(start);
            t.getTime() <= end.getTime();
            t = new Date(t.getTime() + stepMin * 60000)
        ) {
            const hh = String(t.getHours()).padStart(2, '0');
            const mm = String(t.getMinutes()).padStart(2, '0');
            opts.push(`${hh}:${mm}`);
        }
        return opts;
    }, [date, startHour, endHour, stepMin]);

    const [startSel, setStartSel] = useState<string>(
        () => `${String(startHour).padStart(2, '0')}:00`,
    );
    const [endSel, setEndSel] = useState<string>(
        () => `${String(Math.min(endHour, startHour + 1)).padStart(2, '0')}:00`,
    );

    // Ajusta seleção quando configuração muda
    useEffect(() => {
        const startDefault = `${String(startHour).padStart(2, '0')}:00`;
        const endDefault = `${String(
            Math.max(startHour + 1, Math.min(endHour, startHour + 1)),
        ).padStart(2, '0')}:00`;
        if (!timeOptions.includes(startSel)) setStartSel(startDefault);
        if (!timeOptions.includes(endSel)) setEndSel(endDefault);
    }, [timeOptions, startHour, endHour, startSel, endSel]);

    function changeDay(delta: number) {
        const d = new Date(date);
        d.setDate(d.getDate() + delta);
        setDate(d);
        params.set('date', toISODate(d));
        setParams(params, { replace: true });
    }

    return (
        <div style={{ padding: '1rem' }}>
            {/* Header fixo com título e datapicker iterativo */}
            <div
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 5,
                    background: '#f8fafc',
                    paddingBottom: 10,
                    marginBottom: 12,
                    borderBottom: '1px solid #e5e7eb',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                    }}
                >
                    <h2
                        style={{
                            margin: 0,
                            fontWeight: 800,
                            fontSize: 22,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}
                    >
                        <span aria-hidden='true'>📅</span>
                        <span>Agenda</span>
                    </h2>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}
                    >
                        <button
                            onClick={() => navigate('/agenda/settings')}
                            aria-label='Configurações'
                            title='Configurações da Agenda'
                            style={{
                                padding: '6px 10px',
                                borderRadius: 8,
                                border: '1px solid #e5e7eb',
                                background: '#ffffff',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                            }}
                        >
                            ⚙️
                        </button>
                        <button
                            onClick={() => navigate(-1)}
                            aria-label='Retornar'
                            style={{
                                padding: '6px 10px',
                                borderRadius: 8,
                                border: '1px solid #e5e7eb',
                                background: '#ffffff',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                            }}
                        >
                            ✅ Ok
                        </button>
                    </div>
                </div>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 10,
                    }}
                >
                    <button
                        aria-label='Dia anterior'
                        onClick={() => changeDay(-1)}
                        style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: '1px solid #e5e7eb',
                            background: '#ffffff',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                        }}
                    >
                        ◀
                    </button>
                    <input
                        type='date'
                        value={toISODate(date)}
                        onChange={e => {
                            const val = e.target.value;
                            const d = parseDateParam(val);
                            setDate(d);
                            params.set('date', toISODate(d));
                            setParams(params, { replace: true });
                        }}
                        style={{ padding: 6 }}
                        aria-label='Selecionar data'
                    />
                    <button
                        aria-label='Próximo dia'
                        onClick={() => changeDay(1)}
                        style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: '1px solid #e5e7eb',
                            background: '#ffffff',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                        }}
                    >
                        ▶
                    </button>
                    <span
                        style={{
                            color: '#6b7280',
                            fontSize: 16,
                            whiteSpace: 'nowrap',
                        }}
                        aria-label={`Período configurado: ${fmtHour(
                            startHour,
                        )} até ${fmtHour(endHour)}`}
                        title={`Período configurado`}
                    >
                        {fmtHour(startHour)} - {fmtHour(endHour)}
                    </span>
                </div>
            </div>

            {/* Parte interativa: seleção de Início e Fim */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                }}
            >
                <label
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontWeight: 700,
                    }}
                >
                    Início:
                    <select
                        value={startSel}
                        onChange={e => {
                            const val = e.target.value;
                            setStartSel(val);
                            // garante que fim esteja após início
                            const idx = timeOptions.indexOf(val);
                            const idxEnd = timeOptions.indexOf(endSel);
                            if (idxEnd !== -1 && idxEnd <= idx) {
                                const next =
                                    timeOptions[
                                        Math.min(
                                            idx + 1,
                                            timeOptions.length - 1,
                                        )
                                    ];
                                if (next) setEndSel(next);
                            }
                        }}
                    >
                        {timeOptions.map(t => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>
                </label>

                <label
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontWeight: 700,
                    }}
                >
                    Fim:
                    <select
                        value={endSel}
                        onChange={e => {
                            const val = e.target.value;
                            // impede selecionar fim antes ou igual ao início
                            const idx = timeOptions.indexOf(val);
                            const idxStart = timeOptions.indexOf(startSel);
                            if (idx !== -1 && idx > idxStart) setEndSel(val);
                        }}
                    >
                        {timeOptions.map(t => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
        </div>
    );
}
