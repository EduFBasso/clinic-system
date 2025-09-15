// Moved from MiniScheduler.tsx — canonical file for ScheduleModal
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
    editAppointment,
}: {
    open: boolean;
    onClose: () => void;
    client?: ClientBasic; // agora opcional para permitir criação sem cartão selecionado
    defaultDate?: Date;
    editAppointment?: Appointment | null;
}) {
    const TITLE_GREEN = '#065f46';
    const ARROW_HOVER = '#064e3b';
    const ARROW_ACTIVE = '#052e22';
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
        return startOfDay(new Date());
    });
    // Persist selection per client
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
    // Tipos de visita (sincronizado com QuickScheduleModal)
    const [visitType, setVisitType] = React.useState<
        'consulta' | 'avaliacao' | 'retorno' | 'procedimento' | 'outro'
    >((): 'consulta' | 'avaliacao' | 'retorno' | 'procedimento' | 'outro' => {
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
    const [setDefaultVisitType, setSetDefaultVisitType] = React.useState(false);
    const [notes, setNotes] = React.useState<string>('');
    const [editingId, setEditingId] = React.useState<number | null>(null);
    // UI interaction states
    const [prevHover, setPrevHover] = React.useState(false);
    const [prevActive, setPrevActive] = React.useState(false);
    const [nextHover, setNextHover] = React.useState(false);
    const [nextActive, setNextActive] = React.useState(false);
    const [dateFocused, setDateFocused] = React.useState(false);
    // Modo leitura removido (simplificação) — mantemos layout compacto fixo

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

    // When entering edit mode, prefill fields from the appointment
    React.useEffect(() => {
        if (!open) return;
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
                [60, 90, 120, 150] as DurationOption[]
            ).reduce((prev, cur) =>
                Math.abs(cur - diffMin) < Math.abs(prev - diffMin) ? cur : prev,
            );
            setDuration(closest);
            setNotes(editAppointment.notes || '');
            setEditingId(editAppointment.id);
        } else {
            // creating new
            setEditingId(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, editAppointment?.id]);

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

    // Raw (no BUFFER) busy blocks for suggestion computation
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
    // windowFreeSegments removido (simplificação) — usamos apenas cálculo unificado do dia

    // Lê horário inicial e final do expediente das configurações salvas
    function readWorkTimes() {
        const ws = localStorage.getItem('agenda.workStart') || '06:00';
        const we = localStorage.getItem('agenda.workEnd') || '21:00';
        const [sh, sm] = ws.split(':').map(n => parseInt(n, 10));
        const [eh, em] = we.split(':').map(n => parseInt(n, 10));
        return {
            startHour: isNaN(sh) ? 6 : sh,
            startMin: isNaN(sm) ? 0 : sm,
            endHour: isNaN(eh) ? 21 : eh,
            endMin: isNaN(em) ? 0 : em,
        };
    }
    const workTimes = React.useMemo(readWorkTimes, []);
    // Cortes fixos apenas para colorir (manhã / tarde / noite)
    const cutNoon = 12; // meio-dia
    const cutEvening = 18; // início noite

    // ---------- Intervalos livres do dia inteiro (unificado) ----------
    const dayFreeSegments = React.useMemo(() => {
        // limita aos horários configurados de expediente, incluindo minutos
        const start = new Date(selectedDay);
        start.setHours(workTimes.startHour, workTimes.startMin, 0, 0);
        const end = new Date(selectedDay);
        end.setHours(workTimes.endHour, workTimes.endMin, 0, 0);
        const segs: FreeSeg[] = [];
        let cursor = start;
        for (const b of rawBusy) {
            if (b.end <= start || b.start >= end) continue; // fora do expediente
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
        // ordenar cronologicamente (já está, mas por garantia)
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
    // Lógica de sugestões macro removida — focamos apenas na lista granular de intervalos livres
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
                      visit_type: visitType, // permitir alterar tipo na edição longa
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
            if (setDefaultVisitType) {
                try {
                    localStorage.setItem('defaultVisitType', visitType);
                } catch {
                    /* noop */
                }
            }
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
                // pequena defasagem para garantir atualização antes do scroll / highlight
                setTimeout(() => {
                    try {
                        if (client) {
                            window.dispatchEvent(
                                new CustomEvent('scrollToClientCard', {
                                    detail: { clientId: client.id },
                                }),
                            );
                        }
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
            // submitCreate já dispara eventos; caso falhe antes, cairá no catch abaixo
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
                    style={{ fontWeight: 800, fontSize: 20, color: '#111827' }}
                >
                    {editingId ? 'Editar compromisso' : 'Agendar compromisso'}
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>
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
                            <option value='procedimento'>Procedimento</option>
                            <option value='outro'>Outro</option>
                        </select>
                    </label>
                    <label
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginTop: 18,
                        }}
                    >
                        <input
                            type='checkbox'
                            checked={setDefaultVisitType}
                            onChange={e =>
                                setSetDefaultVisitType(e.target.checked)
                            }
                        />
                        <span style={{ fontSize: 12, color: '#6b7280' }}>
                            Definir como padrão
                        </span>
                    </label>
                </div>
                {/* Intervalos livres (granular) */}
                <div
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                >
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
                        {/* Resumo (removido conforme simplificação solicitada) */}
                        <div
                            style={{
                                display: 'flex',
                                gap: 6,
                                flexWrap: 'wrap',
                            }}
                        >
                            {dayFreeSegments.map((seg, idx) => {
                                // Determina cor conforme período de início
                                const h = seg.start.getHours();
                                let bg = '#ecfdf5';
                                let border = '#059669';
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
                                {editingId ? 'Salvar' : 'Agendar'}
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
