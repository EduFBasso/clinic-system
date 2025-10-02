import React from 'react';
import { focusClientCard } from '../utils/focusClientCard';
import { getNow } from '../utils/now';
import type { ClientBasic } from '../types/ClientBasic';
import { useAppointments } from '../hooks/useAppointments';
import type { Appointment } from '../hooks/useAppointments';
import { API_BASE } from '../config/api';
import { isTokenExpired } from '../utils/jwt';
import { FaArrowLeft, FaArrowRight } from 'react-icons/fa';
import {
    getDefaultDuration,
    getSlotInterval,
    getWorkTimes,
} from '../utils/agendaSettings';

type DurationOption = 30 | 60 | 90 | 120 | 150;

function pad2(n: number) {
    return String(n).padStart(2, '0');
}
function makeDayTime(day: string, h: number, m: number) {
    return new Date(`${day}T${pad2(h)}:${pad2(m)}:00`);
}
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
function addMinutes(d: Date, mins: number) {
    const x = new Date(d);
    x.setMinutes(x.getMinutes() + mins);
    return x;
}
function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
    return aStart < bEnd && aEnd > bStart; // [start,end)
}

export default function ScheduleEditorCore({
    isOpen = true,
    onClose,
    client,
    defaultDate,
    editAppointment,
}: {
    isOpen?: boolean;
    onClose: () => void;
    client?: ClientBasic;
    defaultDate?: Date;
    editAppointment?: Appointment | null;
}) {
    const TITLE_GREEN = 'var(--color-success-dark)';
    const ARROW_HOVER = 'var(--color-success-darker)';
    const ARROW_ACTIVE = 'var(--color-success-deep)';
    const [selectedDay, setSelectedDay] = React.useState<Date>(() => {
        if (client) {
            try {
                const key = `schedule:lastDay:${client.id}`;
                const stored = localStorage.getItem(key);
                if (stored) {
                    const d = startOfDay(new Date(stored));
                    if (!isNaN(d.getTime())) return d;
                }
            } catch {
                /* ignore */
            }
        }
        if (defaultDate) return startOfDay(defaultDate);
        return startOfDay(addDays(new Date(), 7));
    });
    React.useEffect(() => {
        if (!client) return;
        try {
            const key = `schedule:lastDay:${client.id}`;
            localStorage.setItem(key, selectedDay.toISOString());
        } catch {
            /* ignore */
        }
    }, [client, selectedDay]);
    const dayISO = toISODate(selectedDay);
    const { items, loading } = useAppointments(selectedDay);
    const [stableItems, setStableItems] = React.useState(items);
    React.useEffect(() => {
        if (!loading) setStableItems(items);
    }, [items, loading]);
    const effectiveItems = loading ? stableItems : items;

    const BUFFER = 30;
    const [duration, setDuration] = React.useState<DurationOption>(() =>
        getDefaultDuration(),
    );
    const initialHM = React.useMemo(() => {
        const ws = getWorkTimes();
        const step = getSlotInterval();
        const now = getNow();
        const isToday = toISODate(selectedDay) === toISODate(now);
        let base = new Date(selectedDay);
        if (isToday) {
            base = now;
        } else {
            base.setHours(ws.startHour, ws.startMin, 0, 0);
        }
        const m = base.getMinutes();
        const nextM = Math.ceil(m / step) * step;
        if (nextM >= 60) {
            base.setHours(base.getHours() + 1, 0, 0, 0);
        } else {
            base.setMinutes(nextM, 0, 0);
        }
        const workStartSel = new Date(selectedDay);
        workStartSel.setHours(ws.startHour, ws.startMin, 0, 0);
        if (base < workStartSel) base = workStartSel;
        return { h: base.getHours(), m: base.getMinutes() };
    }, [selectedDay]);
    const [hour, setHour] = React.useState<number>(initialHM.h);
    const [minute, setMinute] = React.useState<number>(initialHM.m);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [offerReplace, setOfferReplace] = React.useState(false);
    const [conflicts, setConflicts] = React.useState<Appointment[]>([]);
    const [visitType, setVisitType] = React.useState<
        'consulta' | 'avaliacao' | 'retorno' | 'procedimento' | 'outro'
    >(() => {
        const raw = localStorage.getItem('defaultVisitType');
        if (
            raw === 'consulta' ||
            raw === 'avaliacao' ||
            raw === 'retorno' ||
            raw === 'procedimento' ||
            raw === 'outro'
        )
            return raw;
        try {
            localStorage.setItem('defaultVisitType', 'consulta');
        } catch {
            /* noop */
        }
        return 'consulta';
    });
    const [notes, setNotes] = React.useState<string>('');
    const [editingId, setEditingId] = React.useState<number | null>(null);
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
        if (!client) return;
        try {
            const key = `schedule:lastDay:${client.id}`;
            localStorage.setItem(key, nd.toISOString());
        } catch {
            /* ignore */
        }
    }

    React.useEffect(() => {
        if (!isOpen) return;
        if (editAppointment && editAppointment.id) {
            const s = new Date(editAppointment.start_at);
            const e = new Date(editAppointment.end_at);
            persistSelectedDay(startOfDay(s));
            setHour(s.getHours());
            setMinute(s.getMinutes());
            const diffMin = Math.max(
                5,
                Math.round((e.getTime() - s.getTime()) / 60000),
            );
            const closest: DurationOption = (
                [30, 60, 90, 120, 150] as DurationOption[]
            ).reduce((prev, cur) =>
                Math.abs(cur - diffMin) < Math.abs(prev - diffMin) ? cur : prev,
            );
            setDuration(closest);
            setNotes(editAppointment.notes || '');
            setEditingId(editAppointment.id);
        } else {
            setEditingId(null);
            if (!defaultDate) {
                const d = startOfDay(addDays(new Date(), 7));
                setSelectedDay(d);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, editAppointment?.id]);

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

    const rawBusy = React.useMemo(() => {
        return effectiveItems
            .filter(a => a.status !== 'canceled')
            .map(a => ({
                start: new Date(a.start_at),
                end: new Date(a.end_at),
            }))
            .sort((a, b) => a.start.getTime() - b.start.getTime());
    }, [effectiveItems]);

    interface FreeSeg {
        start: Date;
        end: Date;
        lengthMin: number;
    }

    const workTimes = React.useMemo(getWorkTimes, []);
    const slotInterval = React.useMemo(getSlotInterval, []);
    const minutesList = React.useMemo(() => {
        const step = Math.max(1, Math.min(30, slotInterval));
        const arr: number[] = [];
        for (let m = 0; m < 60; m += step) arr.push(m);
        return arr;
    }, [slotInterval]);

    const cutNoon = 12;
    const cutEvening = 18;

    const dayFreeSegments = React.useMemo(() => {
        const start = new Date(selectedDay);
        start.setHours(workTimes.startHour, workTimes.startMin, 0, 0);
        const end = new Date(selectedDay);
        end.setHours(workTimes.endHour, workTimes.endMin, 0, 0);
        const segs: FreeSeg[] = [];
        let cursor = start;
        for (const b of rawBusy) {
            if (b.end <= start || b.start >= end) continue;
            const bs = b.start < start ? start : b.start;
            const be = b.end > end ? end : b.end;
            if (bs > cursor) {
                const len = (bs.getTime() - cursor.getTime()) / 60000;
                if (len >= 15)
                    segs.push({
                        start: new Date(cursor),
                        end: new Date(bs),
                        lengthMin: len,
                    });
            }
            if (be > cursor) cursor = new Date(be);
            if (cursor >= end) break;
        }
        if (cursor < end) {
            const len = (end.getTime() - cursor.getTime()) / 60000;
            if (len >= 15)
                segs.push({
                    start: new Date(cursor),
                    end: new Date(end),
                    lengthMin: len,
                });
        }
        return segs.sort((a, b) => a.start.getTime() - b.start.getTime());
    }, [
        rawBusy,
        selectedDay,
        workTimes.startHour,
        workTimes.startMin,
        workTimes.endHour,
        workTimes.endMin,
    ]);

    function fmtHM(d: Date) {
        return d.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    const startCandidate = React.useMemo(
        () => makeDayTime(dayISO, hour, minute),
        [dayISO, hour, minute],
    );
    const endCandidate = React.useMemo(
        () => addMinutes(startCandidate, duration),
        [startCandidate, duration],
    );

    const workStartBound = React.useMemo(
        () => makeDayTime(dayISO, workTimes.startHour, workTimes.startMin),
        [dayISO, workTimes.startHour, workTimes.startMin],
    );
    const workEndBound = React.useMemo(
        () => makeDayTime(dayISO, workTimes.endHour, workTimes.endMin),
        [dayISO, workTimes.endHour, workTimes.endMin],
    );

    const startAllowed = React.useMemo(
        () =>
            startCandidate >= workStartBound &&
            endCandidate <= workEndBound &&
            !busy.some(b =>
                overlaps(startCandidate, endCandidate, b.start, b.end),
            ),
        [busy, startCandidate, endCandidate, workStartBound, workEndBound],
    );
    const isRetroactive = React.useMemo(() => {
        const now = new Date();
        const todayISO = toISODate(now);
        if (dayISO < todayISO) return true;
        if (dayISO > todayISO) return false;
        return startCandidate < now;
    }, [dayISO, startCandidate]);
    const canSubmit = startAllowed && !isRetroactive;

    const hoursRange = React.useMemo(() => {
        const startH = Math.max(0, Math.min(23, workTimes.startHour));
        const endH = Math.max(startH, Math.min(23, workTimes.endHour));
        const len = endH - startH + 1;
        return Array.from({ length: len }, (_, i) => startH + i);
    }, [workTimes.startHour, workTimes.endHour]);

    const hourHasAnyValidMinute = React.useMemo(() => {
        const map: Record<number, boolean> = {};
        for (const h of hoursRange) {
            let ok = false;
            for (const m of minutesList) {
                const s = makeDayTime(dayISO, h, m);
                const e = addMinutes(s, duration);
                if (
                    s >= workStartBound &&
                    e <= workEndBound &&
                    !busy.some(b => overlaps(s, e, b.start, b.end))
                ) {
                    ok = true;
                    break;
                }
            }
            map[h] = ok;
        }
        return map;
    }, [
        hoursRange,
        minutesList,
        dayISO,
        duration,
        busy,
        workStartBound,
        workEndBound,
    ]);

    const clientConflicts = React.useMemo(() => {
        const s = new Date(`${dayISO}T${toHHMM(startCandidate)}:00`);
        const e = new Date(`${dayISO}T${toHHMM(endCandidate)}:00`);
        return effectiveItems.filter(
            a =>
                a.status === 'scheduled' &&
                overlaps(s, e, new Date(a.start_at), new Date(a.end_at)),
        );
    }, [effectiveItems, dayISO, startCandidate, endCandidate]);

    const hasConflict = React.useMemo(
        () => clientConflicts.length > 0,
        [clientConflicts.length],
    );

    const DURATION_OPTIONS: DurationOption[] = [30, 60, 90, 120, 150];
    function formatDurationLabel(mins: DurationOption) {
        switch (mins) {
            case 30:
                return '30 min';
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
            const isEdit = !!editingId;
            const url = isEdit
                ? `${API_BASE}/agenda/appointments/${editingId}/`
                : `${API_BASE}/agenda/appointments/`;
            const method = isEdit ? 'PATCH' : 'POST';
            if (!client) {
                setError('Selecione um cliente antes de salvar.');
                setSaving(false);
                return;
            }
            const payload = isEdit
                ? {
                      start_at: startISO,
                      end_at: endISO,
                      notes,
                      visit_type: visitType,
                  }
                : {
                      client: client.id,
                      title: 'Consulta',
                      visit_type: visitType,
                      start_at: startISO,
                      end_at: endISO,
                      status: 'scheduled',
                      notes,
                  };
            const r = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
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
                void window.dispatchEvent(
                    new CustomEvent('appointments:changed', { detail: {} }),
                );
                setTimeout(() => {
                    try {
                        if (client) focusClientCard(client.id);
                        window.dispatchEvent(
                            new CustomEvent('systemMessage', {
                                detail: {
                                    type: 'success',
                                    message: editingId
                                        ? 'Agendamento atualizado com sucesso'
                                        : 'Agendamento criado com sucesso',
                                },
                            }),
                        );
                    } catch (e) {
                        void e;
                    }
                }, 50);
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
        <div style={{ display: 'grid', gap: 12, minWidth: 280 }}>
            <div style={{ fontWeight: 800, fontSize: 20, color: '#111827' }}>
                {editingId ? 'Editar compromisso' : 'Agendar compromisso'}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Tipo</span>
                    <select
                        value={visitType}
                        onChange={e =>
                            setVisitType(e.target.value as typeof visitType)
                        }
                        style={{ padding: '6px 8px', minWidth: 140 }}
                    >
                        <option value='consulta'>Consulta</option>
                        <option value='avaliacao'>Avaliação</option>
                        <option value='retorno'>Retorno</option>
                        <option value='procedimento'>Procedimento</option>
                        <option value='outro'>Outro</option>
                    </select>
                </label>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        marginTop: 4,
                    }}
                >
                    <div
                        style={{
                            fontSize: 16,
                            color: '#6b7280',
                            marginBottom: 4,
                            fontWeight: 600,
                        }}
                    >
                        Intervalos livres
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {dayFreeSegments.map((seg, idx) => {
                            const h = seg.start.getHours();
                            let bg = '#ecfdf5';
                            let border = 'var(--color-success)';
                            if (h >= cutNoon && h < cutEvening) {
                                bg = '#fffbeb';
                                border = '#b45309';
                            } else if (h >= cutEvening) {
                                bg = '#f5f3ff';
                                border = '#7c3aed';
                            }
                            const clickable = true;
                            return (
                                <button
                                    key={idx}
                                    style={{
                                        padding: '6px 10px',
                                        borderRadius: 999,
                                        background: bg,
                                        border: `1px solid ${border}`,
                                        cursor: clickable
                                            ? 'pointer'
                                            : 'default',
                                        fontSize: 14,
                                        lineHeight: 1.25,
                                        display: 'flex',
                                        gap: 6,
                                        alignItems: 'center',
                                        fontWeight: 600,
                                        color: '#111827',
                                    }}
                                    onClick={() => {
                                        const s = new Date(seg.start);
                                        setHour(s.getHours());
                                        setMinute(s.getMinutes());
                                        const ddRaw = localStorage.getItem(
                                            'agenda.defaultDuration',
                                        );
                                        const dd = (() => {
                                            const n = parseInt(
                                                ddRaw || '60',
                                                10,
                                            );
                                            return !isNaN(n) &&
                                                n > 0 &&
                                                n <= 240
                                                ? n
                                                : 60;
                                        })();
                                        const suggestedEnd = addMinutes(s, dd);
                                        const end =
                                            suggestedEnd > seg.end
                                                ? seg.end
                                                : suggestedEnd;
                                        const diff = Math.max(
                                            5,
                                            Math.round(
                                                (end.getTime() - s.getTime()) /
                                                    60000,
                                            ),
                                        );
                                        const closest: DurationOption = (
                                            [
                                                30, 60, 90, 120, 150,
                                            ] as DurationOption[]
                                        ).reduce(
                                            (prev, cur) =>
                                                Math.abs(cur - diff) <
                                                Math.abs(prev - diff)
                                                    ? cur
                                                    : prev,
                                            60 as DurationOption,
                                        );
                                        setDuration(closest);
                                    }}
                                    title={`Usar início ${fmtHM(
                                        seg.start,
                                    )} (livre ${Math.round(
                                        seg.lengthMin,
                                    )} min)`}
                                >
                                    <span
                                        style={{
                                            fontWeight: 700,
                                            color: border,
                                        }}
                                    >
                                        {fmtHM(seg.start)}
                                    </span>
                                    <span style={{ opacity: 0.6 }}>→</span>
                                    <span>{fmtHM(seg.end)}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
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
                    onClick={() => persistSelectedDay(addDays(selectedDay, -1))}
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
                            dateFocused ? 'var(--color-success)' : TITLE_GREEN
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
                    onClick={() => persistSelectedDay(addDays(selectedDay, 1))}
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
            <div style={{ display: 'grid', gap: 10 }}>
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
                            {hoursRange.map((h, i) => {
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
                                                ? '#ecfdf5'
                                                : 'transparent',
                                            color: ok
                                                ? 'var(--color-success-dark)'
                                                : '#9ca3af',
                                            fontWeight: selected ? 800 : 600,
                                            border: 0,
                                            // Usa um único separador entre itens (evita "dupla linha")
                                            borderTop:
                                                i > 0
                                                    ? '1px solid #e5e7eb'
                                                    : 'none',
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
                            {minutesList.map((m, idx) => {
                                const s = makeDayTime(dayISO, hour, m);
                                const e = addMinutes(s, duration);
                                const allowed =
                                    s >= workStartBound &&
                                    e <= workEndBound &&
                                    !busy.some(b =>
                                        overlaps(s, e, b.start, b.end),
                                    );
                                const selected = m === minute;
                                return (
                                    <button
                                        key={m}
                                        onClick={() => allowed && setMinute(m)}
                                        disabled={!allowed}
                                        style={{
                                            width: '100%',
                                            textAlign: 'left',
                                            padding: '8px 10px',
                                            background: selected
                                                ? allowed
                                                    ? '#ecfdf5'
                                                    : 'var(--color-danger-bg)'
                                                : 'transparent',
                                            color: allowed
                                                ? 'var(--color-success-dark)'
                                                : 'var(--color-danger-dark)',
                                            fontWeight: selected ? 800 : 600,
                                            border: 0,
                                            // Único separador entre itens, consistente com coluna Hora
                                            borderTop:
                                                idx > 0
                                                    ? '1px solid #e5e7eb'
                                                    : 'none',
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
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                                            ? '2px solid var(--color-success)'
                                            : '1px solid #e5e7eb',
                                        background: selected
                                            ? '#ecfdf5'
                                            : 'white',
                                        color: 'var(--color-success-dark)',
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

                <div
                    style={{
                        padding: '12px 14px',
                        border: '1px solid #d1fae5',
                        borderLeft: '6px solid var(--color-success)',
                        background: '#F8FAFC',
                        color: 'var(--color-success-dark)',
                        marginTop: 12,
                        borderRadius: 10,
                        display: 'grid',
                        gap: 8,
                    }}
                >
                    <div>
                        <span>Nome: </span>
                        {client ? (
                            <span style={{ fontWeight: 800 }}>
                                {client.first_name} {client.last_name}
                            </span>
                        ) : (
                            <span
                                style={{
                                    fontStyle: 'italic',
                                    color: '#047857',
                                }}
                            >
                                Selecione um cliente acima
                            </span>
                        )}
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
                            {toHHMM(startCandidate)} - {toHHMM(endCandidate)}
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
                                color: 'var(--color-success-dark)',
                            }}
                        />
                    </div>
                    {(isRetroactive || (!hasConflict && !startAllowed)) && (
                        <div
                            style={{
                                color: 'var(--color-danger-dark)',
                                fontWeight: 700,
                            }}
                        >
                            {isRetroactive
                                ? 'Não é possível criar compromisso no passado. Ajuste data/horário.'
                                : 'Indisponível (fora do expediente ou intervalo indisponível)'}
                        </div>
                    )}
                    {hasConflict && (
                        <div
                            style={{
                                color: 'var(--color-danger-dark)',
                                fontWeight: 700,
                            }}
                        >
                            Há conflito no mesmo horário. Use “Substituir e
                            salvar” para cancelar os conflitantes e criar este.
                        </div>
                    )}
                </div>

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
                                        borderLeft:
                                            '6px solid var(--color-danger)',
                                        background: 'var(--color-danger-bg)',
                                        color: 'var(--color-danger-dark)',
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
                                            <div
                                                style={{
                                                    fontWeight: 800,
                                                    marginBottom: 4,
                                                }}
                                            >
                                                Observações
                                            </div>
                                            <div>{c.notes}</div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                <div
                    style={{
                        display: 'flex',
                        gap: 8,
                        justifyContent: 'flex-end',
                        marginTop: 8,
                    }}
                >
                    {/* Primary actions: conflict => show red replace; else normal save. Keep server-driven offerReplace as fallback */}
                    <button
                        onClick={onClose}
                        disabled={saving}
                        style={{
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: '1px solid #e5e7eb',
                            background: '#fff',
                        }}
                    >
                        Cancelar
                    </button>
                    {hasConflict || offerReplace ? (
                        <button
                            onClick={replaceConflictsAndCreate}
                            disabled={saving || isRetroactive}
                            style={{
                                padding: '8px 12px',
                                borderRadius: 8,
                                border: '1px solid var(--color-danger-dark)',
                                background: 'var(--color-danger)',
                                color: '#fff',
                            }}
                            title={
                                isRetroactive
                                    ? 'Indisponível no passado'
                                    : 'Substituir conflitos e salvar'
                            }
                        >
                            Substituir e salvar
                        </button>
                    ) : (
                        <button
                            onClick={() => submitCreate(false)}
                            disabled={!canSubmit || saving}
                            style={{
                                padding: '8px 12px',
                                borderRadius: 8,
                                border: '1px solid var(--color-success)',
                                background: canSubmit ? '#10b981' : '#9CA3AF',
                                color: '#fff',
                            }}
                            title={canSubmit ? 'Salvar' : 'Indisponível'}
                        >
                            {editingId ? 'Salvar alterações' : 'Salvar'}
                        </button>
                    )}
                </div>

                {error && (
                    <div
                        style={{
                            color: 'var(--color-danger)',
                            fontWeight: 700,
                        }}
                    >
                        {String(error)}
                    </div>
                )}
            </div>
        </div>
    );
}
