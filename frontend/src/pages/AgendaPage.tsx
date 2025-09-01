import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppointments } from '../hooks/useAppointments';
import { API_BASE } from '../config/api';

function parseDateParam(s?: string | null) {
    if (!s) return new Date();
    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(s);
    if (!m) return new Date();
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d;
}

function toISODate(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

function formatTime(dt: Date) {
    return dt.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function generateSlots(day: Date, startHour = 8, endHour = 18, stepMin = 30) {
    const slots: { start: Date; end: Date }[] = [];
    const start = new Date(day);
    start.setHours(startHour, 0, 0, 0);
    const end = new Date(day);
    end.setHours(endHour, 0, 0, 0);
    for (
        let t = new Date(start);
        t < end;
        t = new Date(t.getTime() + stepMin * 60000)
    ) {
        const e = new Date(t.getTime() + stepMin * 60000);
        slots.push({ start: new Date(t), end: e });
    }
    return slots;
}

export default function AgendaPage() {
    const [params, setParams] = useSearchParams();
    const clientParam = params.get('client');
    const dateParam = params.get('date');
    const [date, setDate] = useState<Date>(() => parseDateParam(dateParam));
    const clientId = clientParam ? Number(clientParam) : undefined;

    const { items, loading } = useAppointments(date, clientId);

    const busyIntervals = useMemo(() => {
        return items
            .filter(i => i.status === 'scheduled')
            .map(i => ({
                start: new Date(i.start_at),
                end: new Date(i.end_at),
            }));
    }, [items]);

    const allSlots = useMemo(() => generateSlots(date), [date]);
    const freeSlots = useMemo(() => {
        return allSlots.filter(
            slot =>
                !busyIntervals.some(
                    b => slot.start < b.end && slot.end > b.start,
                ),
        );
    }, [allSlots, busyIntervals]);

    function changeDay(delta: number) {
        const d = new Date(date);
        d.setDate(d.getDate() + delta);
        setDate(d);
        params.set('date', toISODate(d));
        setParams(params, { replace: true });
    }

    async function quickCreate(slot: { start: Date; end: Date }) {
        if (!clientId) {
            alert('Selecione um cliente (volte no cartão e clique em +).');
            return;
        }
        const token = localStorage.getItem('accessToken');
        const payload = {
            professional: JSON.parse(
                localStorage.getItem('loggedProfessional') || '{}',
            )?.id,
            client: clientId,
            title: 'Consulta',
            visit_type: 'avaliacao',
            start_at: slot.start.toISOString(),
            end_at: slot.end.toISOString(),
            status: 'scheduled',
        };
        const res = await fetch(`${API_BASE}/agenda/appointments/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });
        if (res.ok) {
            // Recarrega a página do dia atual para refletir
            setParams(params, { replace: true });
            // força um refresh simples
            window.location.reload();
        } else {
            const txt = await res.text();
            alert('Erro ao agendar: ' + txt);
        }
    }

    return (
        <div style={{ padding: '1rem' }}>
            <h2 style={{ margin: 0 }}>Agenda</h2>
            {/* Navegação por dia - mobile first */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    margin: '0.75rem 0',
                }}
            >
                <button onClick={() => changeDay(-1)} aria-label='Dia anterior'>
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
                    style={{ flex: 1, padding: 6 }}
                />
                <button onClick={() => changeDay(1)} aria-label='Próximo dia'>
                    ▶
                </button>
            </div>

            {/* Lista de agendados do dia */}
            <div style={{ marginTop: 12 }}>
                <h3 style={{ margin: '8px 0' }}>Agendados</h3>
                {loading ? (
                    <div>Carregando…</div>
                ) : items.length ? (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {items.map(a => (
                            <li
                                key={a.id}
                                style={{
                                    padding: '8px 6px',
                                    borderBottom: '1px solid #eee',
                                }}
                            >
                                <strong>
                                    {new Date(a.start_at).toLocaleTimeString(
                                        'pt-BR',
                                        { hour: '2-digit', minute: '2-digit' },
                                    )}
                                </strong>
                                {' — '}
                                <span>{a.title}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div>Nenhum agendamento.</div>
                )}
            </div>

            {/* Slots livres para criar rapidamente */}
            <div style={{ marginTop: 16 }}>
                <h3 style={{ margin: '8px 0' }}>Horários disponíveis</h3>
                {freeSlots.length ? (
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: 8,
                        }}
                    >
                        {freeSlots.map((s, idx) => (
                            <button
                                key={idx}
                                style={{
                                    padding: '10px 8px',
                                    border: '1px solid #ddd',
                                    borderRadius: 6,
                                }}
                                onClick={() => quickCreate(s)}
                            >
                                {formatTime(s.start)}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div>Nenhum horário livre.</div>
                )}
            </div>
        </div>
    );
}
