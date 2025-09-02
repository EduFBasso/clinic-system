import React, { useEffect, useState } from 'react';
import { API_BASE } from '../config/api';
import { useNavigate } from 'react-router-dom';

type Settings = {
    work_start_hour: number;
    work_end_hour: number;
    slot_minutes: number;
    confirm_message_enabled: boolean;
    confirm_message_template: string;
};

export default function AgendaSettingsPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [s, setS] = useState<Settings>({
        work_start_hour: 8,
        work_end_hour: 18,
        slot_minutes: 30,
        confirm_message_enabled: false,
        confirm_message_template: '',
    });

    useEffect(() => {
        const token = localStorage.getItem('accessToken');
        fetch(`${API_BASE}/register/professionals/settings/`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => r.json())
            .then(data => {
                setS(prev => ({ ...prev, ...data }));
            })
            .finally(() => setLoading(false));
    }, []);

    async function save() {
        setSaving(true);
        const token = localStorage.getItem('accessToken');
        const res = await fetch(
            `${API_BASE}/register/professionals/settings/`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(s),
            },
        );
        setSaving(false);
        if (!res.ok) {
            const txt = await res.text();
            alert('Erro ao salvar: ' + txt);
        } else {
            try {
                localStorage.setItem(
                    'agenda.startHour',
                    String(s.work_start_hour),
                );
                localStorage.setItem('agenda.endHour', String(s.work_end_hour));
                localStorage.setItem('agenda.stepMin', String(s.slot_minutes));
            } catch {
                // ignore localStorage mirror failures
            }
            navigate(-1);
        }
    }

    if (loading) return <div style={{ padding: '1rem' }}>Carregando…</div>;

    return (
        <div style={{ padding: '1rem' }}>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}
            >
                <h2 style={{ margin: 0 }}>Configurações da Agenda</h2>
                <button onClick={() => navigate(-1)}>Voltar</button>
            </div>

            <div
                style={{
                    display: 'grid',
                    gap: 12,
                    marginTop: 12,
                    maxWidth: 520,
                }}
            >
                <label
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                    Início
                    <select
                        value={s.work_start_hour}
                        onChange={e =>
                            setS({
                                ...s,
                                work_start_hour: Number(e.target.value),
                            })
                        }
                    >
                        {Array.from({ length: 24 }, (_, h) => (
                            <option key={h} value={h}>
                                {String(h).padStart(2, '0')}:00
                            </option>
                        ))}
                    </select>
                </label>
                <label
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                    Fim
                    <select
                        value={s.work_end_hour}
                        onChange={e =>
                            setS({
                                ...s,
                                work_end_hour: Number(e.target.value),
                            })
                        }
                    >
                        {Array.from({ length: 24 }, (_, h) => (
                            <option key={h} value={h}>
                                {String(h).padStart(2, '0')}:00
                            </option>
                        ))}
                    </select>
                </label>
                <label
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                    Intervalo
                    <select
                        value={s.slot_minutes}
                        onChange={e =>
                            setS({ ...s, slot_minutes: Number(e.target.value) })
                        }
                    >
                        <option value={15}>15m</option>
                        <option value={30}>30m</option>
                        <option value={60}>1h</option>
                    </select>
                </label>
                <label
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                    Enviar confirmação automática
                    <input
                        type='checkbox'
                        checked={s.confirm_message_enabled}
                        onChange={e =>
                            setS({
                                ...s,
                                confirm_message_enabled: e.target.checked,
                            })
                        }
                    />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                    Template da mensagem (opcional)
                    <textarea
                        rows={4}
                        value={s.confirm_message_template}
                        onChange={e =>
                            setS({
                                ...s,
                                confirm_message_template: e.target.value,
                            })
                        }
                    />
                </label>
                <div>
                    <button disabled={saving} onClick={save}>
                        {saving ? 'Salvando…' : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
