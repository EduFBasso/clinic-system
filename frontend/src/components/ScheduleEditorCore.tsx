import React from 'react';
import { formatTime } from '../utils/timeFormat';
import { getNow } from '../utils/now';
import type { ClientBasic } from '../types/ClientBasic';
import { useAppointments } from '../hooks/useAppointments';
import type { Appointment } from '../hooks/useAppointments';
import { FaArrowLeft, FaArrowRight } from 'react-icons/fa';
import {
    getWorkTimesFromSnapshot,
} from '../utils/agendaSettings';
import { useAgendaSettings } from '../hooks/useAgendaSettings';
import { pad2 } from '../utils/hmTime';
import { toISODate } from '../utils/date';
import { useAvailabilityCalc } from '../hooks/useAvailabilityCalc';
import { useScheduleSave } from '../hooks/useScheduleSave';

type DurationOption = 30 | 60 | 90 | 120 | 150;

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
function toHHMM(d: Date) {
    // Centraliza via util para consistência e futura UTC/locale troca
    return formatTime(d, { mode: 'local' });
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
    const agendaSettings = useAgendaSettings();
    const workTimes = React.useMemo(
        () => getWorkTimesFromSnapshot(agendaSettings),
        [agendaSettings],
    );
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

    const [duration, setDuration] = React.useState<DurationOption>(() =>
        agendaSettings.defaultDuration,
    );
    const initialHM = React.useMemo(() => {
        const ws = workTimes;
        const step = agendaSettings.slotInterval;
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
    }, [agendaSettings.slotInterval, selectedDay, workTimes]);
    const [hour, setHour] = React.useState<number>(initialHM.h);
    const [minute, setMinute] = React.useState<number>(initialHM.m);
    const [visitType, setVisitType] = React.useState<
        'consulta' | 'avaliacao' | 'retorno' | 'procedimento' | 'outro'
    >(() => agendaSettings.defaultVisitType);
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

    const {
        busy,
        dayFreeSegments,
        startCandidate,
        endCandidate,
        workStartBound,
        workEndBound,
        startAllowed,
        isRetroactive,
        canSubmit,
        hourHasAnyValidMinute,
        hoursRange,
        minutesList,
        clientConflicts,
        hasConflict,
        startISO,
        endISO,
    } = useAvailabilityCalc({
        effectiveItems,
        selectedDay,
        dayISO,
        workTimes,
        agendaSettings,
        duration,
        hour,
        minute,
        editingId,
    });

    const cutNoon = 12;
    const cutEvening = 18;

    function fmtHM(d: Date) {
        return formatTime(d, { mode: 'local' });
    }

    const {
        saving,
        error,
        offerReplace,
        conflicts,
        setError: _setError,
        setOfferReplace: _setOfferReplace,
        submitCreate,
        replaceConflictsAndCreate,
    } = useScheduleSave({
        client,
        editingId,
        startISO,
        endISO,
        visitType,
        notes,
        onClose,
    });
    void _setError; // available if needed

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

    return (
        <div style={{ display: 'grid', gap: 12, minWidth: 280 }}>
            <div
                style={{
                    fontWeight: 800,
                    fontSize: 20,
                    color: 'var(--color-heading)',
                }}
            >
                {editingId ? 'Editar compromisso' : 'Agendar compromisso'}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', flexDirection: 'column' }}>
                    <span
                        style={{
                            fontSize: 12,
                            color: 'var(--color-text-muted)',
                        }}
                    >
                        Tipo
                    </span>
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
                        <option value='procedimento'>Serviço</option>
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
                            color: 'var(--color-text-muted)',
                            marginBottom: 4,
                            fontWeight: 600,
                        }}
                    >
                        Intervalos livres
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {dayFreeSegments.map((seg, idx) => {
                            const h = seg.start.getHours();
                            let bg = 'var(--color-success-bg)';
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
                                        color: 'var(--color-heading)',
                                    }}
                                    onClick={() => {
                                        const s = new Date(seg.start);
                                        setHour(s.getHours());
                                        setMinute(s.getMinutes());
                                        const suggestedEnd = addMinutes(
                                            s,
                                            agendaSettings.defaultDuration,
                                        );
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
                        background: 'var(--color-success-bg)',
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
                                color: 'var(--color-text-muted)',
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
                                                ? 'var(--color-success-bg)'
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
                                color: 'var(--color-text-muted)',
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
                                                    ? 'var(--color-success-bg)'
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
                            color: 'var(--color-text-muted)',
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
                                            ? 'var(--color-success-bg)'
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
