import React from 'react';
import AppModal from './Modal';
import type { ClientBasic } from '../types/ClientBasic';
import { useAppointments } from '../hooks/useAppointments';
import type { Appointment } from '../hooks/useAppointments';
import { API_BASE } from '../config/api';
import { isTokenExpired } from '../utils/jwt';
import { FaArrowLeft, FaArrowRight } from 'react-icons/fa';

type DurationOption = 60 | 90 | 120 | 150;

function startOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}
function addDays(d: Date, n: number) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
}
function toISODate(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}
function toHHMM(d: Date) {
    return d
        .toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        .slice(0, 5);
}
function parseHM(h: number, m: number) {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
}
function addMinutes(d: Date, mins: number) {
    const x = new Date(d);
    x.setMinutes(x.getMinutes() + mins);
    return x;
}
function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
    return aStart < bEnd && aEnd > bStart; // [start,end)
}

export default function ScheduleModal({
    open,
    onClose,
    client,
    defaultDate,
}: {
    open: boolean;
    onClose: () => void;
    client: ClientBasic;
    defaultDate?: Date;
}) {
    const TITLE_GREEN = '#065f46';
    const ARROW_HOVER = '#064e3b';
    const ARROW_ACTIVE = '#052e22';
    const [selectedDay, setSelectedDay] = React.useState<Date>(() => {
        // Try to restore last selected day for this client
        try {
            const key = `schedule:lastDay:${client.id}`;
            const saved = localStorage.getItem(key);
            if (saved) {
                const d = new Date(saved);
                if (!Number.isNaN(d.getTime())) return startOfDay(d);
            }
        } catch {
            /* ignore */
        }
        return startOfDay(defaultDate ? new Date(defaultDate) : new Date());
    });
    // When client changes, refresh from their last saved day or defaultDate
    React.useEffect(() => {
        try {
            const key = `schedule:lastDay:${client.id}`;
            const saved = localStorage.getItem(key);
            if (saved) {
                const d = new Date(saved);
                if (!Number.isNaN(d.getTime())) {
                    setSelectedDay(startOfDay(d));
                    return;
                }
            }
        } catch {
            /* ignore */
        }
        if (defaultDate) setSelectedDay(startOfDay(defaultDate));
    }, [client.id, defaultDate]);
    // Persist selection per client
    React.useEffect(() => {
        try {
            const key = `schedule:lastDay:${client.id}`;
            localStorage.setItem(key, selectedDay.toISOString());
        } catch {
            /* ignore */
        }
    }, [client.id, selectedDay]);
    const dayISO = toISODate(selectedDay);
    const { items, loading } = useAppointments(selectedDay);
    // Keep last stable items to avoid UI flicker while fetching new day
    const [stableItems, setStableItems] = React.useState(items);
    React.useEffect(() => {
        if (!loading) setStableItems(items);
    }, [items, loading]);
    const effectiveItems = loading ? stableItems : items;

    const BUFFER = 30;
    const [duration, setDuration] = React.useState<DurationOption>(60);
    const [hour, setHour] = React.useState<number>(
        (defaultDate ? new Date(defaultDate) : new Date()).getHours(),
    );
    const [minute, setMinute] = React.useState<number>(0);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [offerReplace, setOfferReplace] = React.useState(false);
    const [conflicts, setConflicts] = React.useState<Appointment[]>([]);
    const [notes, setNotes] = React.useState<string>('');
    // UI interaction states
    const [prevHover, setPrevHover] = React.useState(false);
    const [prevActive, setPrevActive] = React.useState(false);
    const [nextHover, setNextHover] = React.useState(false);
    const [nextActive, setNextActive] = React.useState(false);
    const [dateFocused, setDateFocused] = React.useState(false);

    const prevColor = prevActive
        ? ARROW_ACTIVE
        : prevHover
        ? ARROW_HOVER
        : TITLE_GREEN;
    const nextColor = nextActive
        ? ARROW_ACTIVE
        : nextHover
        ? ARROW_HOVER
        : TITLE_GREEN;

    function persistSelectedDay(nd: Date) {
        setSelectedDay(nd);
        try {
            const key = `schedule:lastDay:${client.id}`;
            localStorage.setItem(key, nd.toISOString());
        } catch {
            /* ignore */
        }
    }

    // Busy blocks with buffer (scheduled/done busy, canceled ignored)
    const busy = React.useMemo(() => {
        const blocks = effectiveItems
            .filter(a => a.status !== 'canceled')
            .map(a => ({
                start: new Date(a.start_at),
                end: new Date(a.end_at),
            }))
            .map(({ start, end }) => ({
                start: addMinutes(start, -BUFFER),
                end: addMinutes(end, BUFFER),
            }))
            .sort((a, b) => a.start.getTime() - b.start.getTime());
        const merged: { start: Date; end: Date }[] = [];
        for (const b of blocks) {
            if (!merged.length) merged.push(b);
            else {
                const last = merged[merged.length - 1];
                if (b.start <= last.end)
                    last.end = b.end > last.end ? b.end : last.end;
                else merged.push(b);
            }
        }
        return merged;
    }, [effectiveItems]);
    const startCandidate = React.useMemo(
        () => parseHM(hour, minute),
        [hour, minute],
    );
    const endCandidate = React.useMemo(
        () => addMinutes(startCandidate, duration),
        [startCandidate, duration],
    );

    const startAllowed = React.useMemo(
        () =>
            !busy.some(b =>
                overlaps(startCandidate, endCandidate, b.start, b.end),
            ),
        [busy, startCandidate, endCandidate],
    );

    const hourHasAnyValidMinute = React.useMemo(() => {
        const map: Record<number, boolean> = {};
        for (let h = 6; h <= 22; h++) {
            let ok = false;
            for (const m of [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]) {
                const s = parseHM(h, m);
                const e = addMinutes(s, duration);
                if (!busy.some(b => overlaps(s, e, b.start, b.end))) {
                    ok = true;
                    break;
                }
            }
            map[h] = ok;
        }
        return map;
    }, [busy, duration]);

    // Live client-side conflict detection (no buffer) for the currently selected range
    const clientConflicts = React.useMemo(() => {
        const s = new Date(`${dayISO}T${toHHMM(startCandidate)}:00`);
        const e = new Date(`${dayISO}T${toHHMM(endCandidate)}:00`);
        return effectiveItems.filter(
            a =>
                a.status === 'scheduled' &&
                overlaps(s, e, new Date(a.start_at), new Date(a.end_at)),
        );
    }, [effectiveItems, dayISO, startCandidate, endCandidate]);

    const DURATION_OPTIONS: DurationOption[] = [60, 90, 120, 150];
    function formatDurationLabel(mins: DurationOption) {
        switch (mins) {
            case 60:
                return '60 min';
            case 90:
                return '1:30 hs';
            case 120:
                return '2:00 hs';
            case 150:
                return '2:30 hs';
        }
    }

    async function submitCreate(replacing = false) {
        setError(null);
        const token = localStorage.getItem('accessToken');
        if (isTokenExpired(token)) {
            setError('Sessão expirada. Faça login novamente.');
            return;
        }
        const startISO = new Date(
            `${dayISO}T${toHHMM(startCandidate)}:00`,
        ).toISOString();
        const endISO = new Date(
            `${dayISO}T${toHHMM(endCandidate)}:00`,
        ).toISOString();
        setSaving(true);
        try {
            const r = await fetch(`${API_BASE}/agenda/appointments/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    client: client.id,
                    title: 'Consulta',
                    visit_type: 'outro',
                    start_at: startISO,
                    end_at: endISO,
                    status: 'scheduled',
                    notes,
                }),
            });
            if (!r.ok) {
                const txt = await r.text();
                if (
                    !replacing &&
                    (/Conflito|conflict/i.test(txt) || r.status === 400)
                ) {
                    setOfferReplace(true);
                    try {
                        const url = `${API_BASE}/agenda/appointments/?start=${encodeURIComponent(
                            startISO,
                        )}&end=${encodeURIComponent(endISO)}&status=scheduled`;
                        const list: unknown = await fetch(url, {
                            headers: { Authorization: `Bearer ${token}` },
                        }).then(rr => rr.json());
                        setConflicts(
                            (Array.isArray(list) ? list : []) as Appointment[],
                        );
                    } catch (e) {
                        void e;
                    }
                    setError(
                        'Conflito detectado. Confirme se deseja substituir.',
                    );
                    return;
                }
                throw new Error(txt || 'Falha ao agendar.');
            }
            try {
                void window.dispatchEvent(new Event('updateClients'));
            } catch (err) {
                void err;
            }
            onClose();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Erro ao agendar.');
        } finally {
            setSaving(false);
        }
    }

    async function replaceConflictsAndCreate() {
        setOfferReplace(false);
        setError(null);
        const token = localStorage.getItem('accessToken');
        if (isTokenExpired(token)) {
            setError('Sessão expirada. Faça login novamente.');
            return;
        }
        const startISO = new Date(
            `${dayISO}T${toHHMM(startCandidate)}:00`,
        ).toISOString();
        const endISO = new Date(
            `${dayISO}T${toHHMM(endCandidate)}:00`,
        ).toISOString();
        setSaving(true);
        try {
            const url = `${API_BASE}/agenda/appointments/?start=${encodeURIComponent(
                startISO,
            )}&end=${encodeURIComponent(endISO)}&status=scheduled`;
            const list: unknown = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            }).then(r => r.json());
            const conflictList = (Array.isArray(list) ? list : []) as Array<{
                id: number;
                status: string;
            }>;
            for (const c of conflictList) {
                await fetch(`${API_BASE}/agenda/appointments/${c.id}/`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ status: 'canceled' }),
                });
            }
            await submitCreate(true);
        } catch (e: unknown) {
            setError(
                e instanceof Error
                    ? e.message
                    : 'Falha ao substituir conflitos.',
            );
        } finally {
            setSaving(false);
        }
    }

    return (
        <AppModal open={open} onClose={onClose} closeOnEnter={false}>
            <div style={{ display: 'grid', gap: 12, minWidth: 280 }}>
                <div
                    style={{
                        fontWeight: 800,
                        fontSize: 26,
                        textAlign: 'center',
                        color: '#065f46',
                    }}
                >
                    Agendar / Editar
                </div>
                {/* Date controls: prev, date picker, next */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        justifyContent: 'center',
                    }}
                >
                    <button
                        aria-label='Dia anterior'
                        onClick={() =>
                            persistSelectedDay(addDays(selectedDay, -1))
                        }
                        onMouseEnter={() => setPrevHover(true)}
                        onMouseLeave={() => {
                            setPrevHover(false);
                            setPrevActive(false);
                        }}
                        onMouseDown={() => setPrevActive(true)}
                        onMouseUp={() => setPrevActive(false)}
                        onTouchStart={() => setPrevActive(true)}
                        onTouchEnd={() => setPrevActive(false)}
                        style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: 'none',
                            background: 'transparent',
                            boxShadow: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        <FaArrowLeft color={prevColor} size={18} />
                    </button>
                    <input
                        type='date'
                        value={dayISO}
                        onChange={e => {
                            const nd = startOfDay(
                                new Date(e.target.value + 'T00:00:00'),
                            );
                            persistSelectedDay(nd);
                        }}
                        onFocus={() => setDateFocused(true)}
                        onBlur={() => setDateFocused(false)}
                        onKeyDown={e => {
                            if (e.key === 'ArrowLeft') {
                                e.preventDefault();
                                persistSelectedDay(addDays(selectedDay, -1));
                            } else if (e.key === 'ArrowRight') {
                                e.preventDefault();
                                persistSelectedDay(addDays(selectedDay, 1));
                            }
                        }}
                        style={{
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: `1px solid ${
                                dateFocused ? '#059669' : TITLE_GREEN
                            }`,
                            background: '#ecfdf5',
                            color: TITLE_GREEN,
                            outlineColor: TITLE_GREEN,
                            accentColor: TITLE_GREEN,
                            fontWeight: 800,
                            fontSize: 18,
                            textAlign: 'center',
                            minWidth: 170,
                            boxShadow: dateFocused
                                ? '0 0 0 3px rgba(5,150,105,0.25)'
                                : 'none',
                        }}
                    />
                    <button
                        aria-label='Próximo dia'
                        onClick={() =>
                            persistSelectedDay(addDays(selectedDay, 1))
                        }
                        onMouseEnter={() => setNextHover(true)}
                        onMouseLeave={() => {
                            setNextHover(false);
                            setNextActive(false);
                        }}
                        onMouseDown={() => setNextActive(true)}
                        onMouseUp={() => setNextActive(false)}
                        onTouchStart={() => setNextActive(true)}
                        onTouchEnd={() => setNextActive(false)}
                        style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: 'none',
                            background: 'transparent',
                            boxShadow: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        <FaArrowRight color={nextColor} size={18} />
                    </button>
                </div>
                {/* Subtle updating hint to avoid full content flash */}
                {loading && (
                    <div
                        style={{
                            textAlign: 'center',
                            color: '#6b7280',
                            fontSize: 12,
                            marginTop: -6,
                        }}
                        aria-live='polite'
                    >
                        Atualizando…
                    </div>
                )}
                <div style={{ display: 'grid', gap: 10 }}>
                    {/* Time wheels */}
                    <div
                        style={{
                            display: 'flex',
                            gap: 16,
                            justifyContent: 'space-between',
                        }}
                    >
                        <div style={{ flex: 1 }}>
                            <div
                                style={{
                                    fontSize: 16,
                                    color: '#6b7280',
                                    marginBottom: 4,
                                }}
                            >
                                Hora
                            </div>
                            <div
                                style={{
                                    maxHeight: 140,
                                    overflowY: 'auto',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: 8,
                                }}
                            >
                                {Array.from(
                                    { length: 17 },
                                    (_, i) => 6 + i,
                                ).map(h => {
                                    const ok = hourHasAnyValidMinute[h];
                                    const selected = h === hour;
                                    return (
                                        <button
                                            key={h}
                                            onClick={() => setHour(h)}
                                            style={{
                                                width: '100%',
                                                textAlign: 'left',
                                                padding: '8px 10px',
                                                background: selected
                                                    ? ok
                                                        ? '#ecfdf5'
                                                        : '#fee2e2'
                                                    : 'transparent',
                                                color: ok
                                                    ? '#065f46'
                                                    : '#b91c1c',
                                                fontWeight: selected
                                                    ? 800
                                                    : 600,
                                                border: 0,
                                                borderBottom:
                                                    '1px solid #e5e7eb',
                                                cursor: 'pointer',
                                            }}
                                            title={
                                                ok
                                                    ? 'Há minutos livres nesta hora'
                                                    : 'Sem minutos válidos (respeito ao intervalo)'
                                            }
                                        >
                                            {String(h).padStart(2, '0')}h
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div
                                style={{
                                    fontSize: 16,
                                    color: '#6b7280',
                                    marginBottom: 4,
                                }}
                            >
                                Minutos
                            </div>
                            <div
                                style={{
                                    maxHeight: 140,
                                    overflowY: 'auto',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: 8,
                                }}
                            >
                                {[
                                    0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50,
                                    55,
                                ].map(m => {
                                    const s = parseHM(hour, m);
                                    const e = addMinutes(s, duration);
                                    const allowed = !busy.some(b =>
                                        overlaps(s, e, b.start, b.end),
                                    );
                                    const selected = m === minute;
                                    return (
                                        <button
                                            key={m}
                                            onClick={() =>
                                                allowed && setMinute(m)
                                            }
                                            disabled={!allowed}
                                            style={{
                                                width: '100%',
                                                textAlign: 'left',
                                                padding: '8px 10px',
                                                background: selected
                                                    ? allowed
                                                        ? '#ecfdf5'
                                                        : '#fee2e2'
                                                    : 'transparent',
                                                color: allowed
                                                    ? '#065F46'
                                                    : '#b91c1c',
                                                fontWeight: selected
                                                    ? 800
                                                    : 600,
                                                border: 0,
                                                borderBottom:
                                                    '1px solid #e5e7eb',
                                                cursor: allowed
                                                    ? 'pointer'
                                                    : 'not-allowed',
                                                opacity: allowed ? 1 : 0.6,
                                            }}
                                            title={
                                                allowed
                                                    ? 'Válido'
                                                    : 'Indisponível (respeito ao intervalo)'
                                            }
                                        >
                                            {String(m).padStart(2, '0')}m
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Duration */}
                    <div style={{ display: 'grid', gap: 4 }}>
                        <div
                            style={{
                                fontSize: 16,
                                color: '#6b7280',
                                marginBottom: 4,
                            }}
                        >
                            Duração
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                gap: 8,
                                flexWrap: 'wrap',
                            }}
                        >
                            {DURATION_OPTIONS.map(d => {
                                const selected = d === duration;
                                return (
                                    <button
                                        key={d}
                                        onClick={() => setDuration(d)}
                                        style={{
                                            padding: '6px 10px',
                                            borderRadius: 999,
                                            border: selected
                                                ? '2px solid #059669'
                                                : '1px solid #e5e7eb',
                                            background: selected
                                                ? '#ecfdf5'
                                                : 'white',
                                            color: '#065f46',
                                            fontWeight: 700,
                                            fontSize: 14,
                                            cursor: 'pointer',
                                        }}
                                        title={`${d} minutos`}
                                    >
                                        {formatDurationLabel(d)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Appointment card (green stripe, gelo background) after time + duration, with editable notes */}
                    <div
                        style={{
                            padding: '12px 14px',
                            border: '1px solid #d1fae5',
                            borderLeft: '6px solid #059669',
                            background: '#F8FAFC',
                            color: '#065f46',
                            marginTop: 12,
                            borderRadius: 10,
                            display: 'grid',
                            gap: 8,
                        }}
                    >
                        <div>
                            <span>Nome: </span>
                            <span style={{ fontWeight: 800 }}>
                                {client.first_name} {client.last_name}
                            </span>
                        </div>
                        <div>
                            <span>Data: </span>
                            <span style={{ fontWeight: 800 }}>
                                {selectedDay.toLocaleDateString('pt-BR', {
                                    weekday: 'short',
                                    day: '2-digit',
                                    month: '2-digit',
                                })}
                            </span>
                        </div>
                        <div>
                            <span>Horário: </span>
                            <span style={{ fontWeight: 800 }}>
                                {toHHMM(startCandidate)} -{' '}
                                {toHHMM(endCandidate)}
                            </span>
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, marginBottom: 4 }}>
                                Observações
                            </div>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder='Observações'
                                rows={2}
                                style={{
                                    width: '100%',
                                    resize: 'vertical',
                                    border: '1px solid #A7F3D0',
                                    borderRadius: 6,
                                    padding: '6px 8px',
                                    background: '#F8FAFC',
                                    color: '#065f46',
                                }}
                            />
                        </div>
                        {!startAllowed && (
                            <div
                                style={{
                                    color: '#991b1b',
                                    fontWeight: 700,
                                }}
                            >
                                Indisponível (respeito ao intervalo)
                            </div>
                        )}
                    </div>

                    {/* Conflict cards (red): show during scroll if overlapping, and also when replacing */}
                    {(clientConflicts.length > 0 ||
                        (offerReplace && conflicts.length > 0)) && (
                        <div style={{ display: 'grid', gap: 8 }}>
                            {(offerReplace && conflicts.length > 0
                                ? conflicts
                                : clientConflicts
                            ).map(c => {
                                const s = new Date(c.start_at);
                                const e = new Date(c.end_at);
                                const nome = c.client_name || 'Cliente';
                                const dataStr = new Date(
                                    s.toISOString().slice(0, 10) + 'T00:00:00',
                                ).toLocaleDateString('pt-BR', {
                                    weekday: 'short',
                                    day: '2-digit',
                                    month: '2-digit',
                                });
                                return (
                                    <div
                                        key={c.id}
                                        style={{
                                            padding: '12px 14px',
                                            border: '1px solid #fee2e2',
                                            borderLeft: '6px solid #b91c1c',
                                            background: '#fef2f2',
                                            color: '#991b1b',
                                            borderRadius: 10,
                                            display: 'grid',
                                            gap: 6,
                                        }}
                                    >
                                        <div>
                                            <span>Nome: </span>
                                            <span style={{ fontWeight: 800 }}>
                                                {nome}
                                            </span>
                                        </div>
                                        <div>
                                            <span>Data: </span>
                                            <span style={{ fontWeight: 800 }}>
                                                {dataStr}
                                            </span>
                                        </div>
                                        <div>
                                            <span>Horário: </span>
                                            <span style={{ fontWeight: 800 }}>
                                                {toHHMM(s)} - {toHHMM(e)}
                                            </span>
                                        </div>
                                        {c.notes && (
                                            <div>
                                                <span>Observações: </span>
                                                <span
                                                    style={{
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {c.notes}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {error && (
                        <div style={{ color: '#b91c1c', fontWeight: 600 }}>
                            {error}
                        </div>
                    )}

                    <div
                        style={{
                            display: 'flex',
                            gap: 8,
                            justifyContent: 'flex-end',
                        }}
                    >
                        <button
                            onClick={onClose}
                            disabled={saving}
                            style={{ padding: '8px 12px' }}
                        >
                            Fechar
                        </button>
                        {!(offerReplace || clientConflicts.length > 0) ? (
                            <button
                                onClick={() => submitCreate(false)}
                                disabled={saving || !startAllowed}
                                style={{
                                    padding: '8px 12px',
                                    background: '#059669',
                                    color: 'white',
                                    borderRadius: 6,
                                    fontWeight: 800,
                                    opacity: saving || !startAllowed ? 0.7 : 1,
                                    cursor:
                                        saving || !startAllowed
                                            ? 'not-allowed'
                                            : 'pointer',
                                }}
                            >
                                Agendar
                            </button>
                        ) : (
                            <button
                                onClick={replaceConflictsAndCreate}
                                disabled={saving || !startAllowed}
                                style={{
                                    padding: '8px 12px',
                                    background: '#b91c1c',
                                    color: 'white',
                                    borderRadius: 6,
                                    fontWeight: 800,
                                    opacity: saving || !startAllowed ? 0.7 : 1,
                                }}
                            >
                                Substituir
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </AppModal>
    );
}
