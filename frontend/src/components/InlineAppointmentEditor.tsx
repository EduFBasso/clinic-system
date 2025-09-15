import React from 'react';
import styles from '../styles/components/InlineAppointmentEditor.module.css';
import { API_BASE } from '../config/api';
import { isTokenExpired } from '../utils/jwt';
import type { ClientBasic } from '../types/ClientBasic';

interface InlineAppointmentEditorProps {
    client: ClientBasic;
    onClose: () => void;
    onSaved?: () => void;
}

function toDateInputValue(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0',
    )}-${String(d.getDate()).padStart(2, '0')}`;
}

type Part =
    | 'date'
    | 'startHour'
    | 'startMinute'
    | 'endHour'
    | 'endMinute'
    | null;

export default function InlineAppointmentEditor({
    client,
    onClose,
    onSaved,
}: InlineAppointmentEditorProps) {
    const existingStart = React.useMemo(
        () =>
            client.next_appointment_start_at
                ? new Date(client.next_appointment_start_at)
                : null,
        [client.next_appointment_start_at],
    );
    const existingEnd = React.useMemo(
        () =>
            client.next_appointment_end_at
                ? new Date(client.next_appointment_end_at)
                : null,
        [client.next_appointment_end_at],
    );
    const baseline = new Date();
    baseline.setMinutes(0, 0, 0);
    baseline.setHours(baseline.getHours() + 1);
    const [date, setDate] = React.useState<string>(() =>
        toDateInputValue(existingStart || baseline),
    );
    const [startHour, setStartHour] = React.useState<number>(() =>
        existingStart ? existingStart.getHours() : baseline.getHours(),
    );
    const [startMinute, setStartMinute] = React.useState<number>(() =>
        existingStart ? existingStart.getMinutes() : 0,
    );
    const [endHour, setEndHour] = React.useState<number>(() =>
        existingEnd
            ? existingEnd.getHours()
            : existingStart
            ? existingStart.getHours() + 1
            : baseline.getHours() + 1,
    );
    const [endMinute, setEndMinute] = React.useState<number>(() =>
        existingEnd ? existingEnd.getMinutes() : startMinute,
    );
    const [editingId, setEditingId] = React.useState<number | null>(null);
    const [activePart, setActivePart] = React.useState<Part>(null);
    const [dirty, setDirty] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const dragInfo = React.useRef<{
        startY: number;
        orig: number;
        part: Part;
    } | null>(null);
    // discover existing appointment id for edit mode (only while mounted & editing)
    React.useEffect(() => {
        if (!existingStart) return;
        let cancelled = false;
        interface MinimalAppt {
            id: number;
            start_at: string;
        }
        (async () => {
            try {
                const token = localStorage.getItem('accessToken');
                if (isTokenExpired(token)) return;
                const day = new Date(existingStart);
                day.setHours(0, 0, 0, 0);
                const dayEnd = new Date(day);
                dayEnd.setDate(dayEnd.getDate() + 1);
                const url = `${API_BASE}/agenda/appointments/?start=${encodeURIComponent(
                    day.toISOString(),
                )}&end=${encodeURIComponent(dayEnd.toISOString())}&client=${
                    client.id
                }`;
                const r = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!r.ok) return;
                const data: MinimalAppt[] = await r.json();
                if (cancelled) return;
                const match = data.find(
                    a => a.start_at === client.next_appointment_start_at,
                );
                if (match) setEditingId(match.id);
            } catch {
                /* ignore */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [existingStart, client.id, client.next_appointment_start_at]);

    // ensure end stays at least 1h after start
    React.useEffect(() => {
        const startTotal = startHour * 60 + startMinute;
        let endTotal = endHour * 60 + endMinute;
        if (endTotal <= startTotal) {
            endTotal = startTotal + 60;
            setEndHour(Math.floor(endTotal / 60) % 24);
            setEndMinute(endTotal % 60);
        }
    }, [startHour, startMinute, endHour, endMinute]);

    function markDirty() {
        if (!dirty) setDirty(true);
    }

    function adjust(part: Part, delta: number) {
        if (!part) return;
        markDirty();
        if (part === 'startHour') {
            setStartHour(h => (h + delta + 24) % 24);
            return;
        }
        if (part === 'endHour') {
            setEndHour(h => (h + delta + 24) % 24);
            return;
        }
        if (part === 'startMinute') {
            setStartMinute(m => {
                let v = m + delta;
                while (v < 0) v += 60;
                return v % 60;
            });
            return;
        }
        if (part === 'endMinute') {
            setEndMinute(m => {
                let v = m + delta;
                while (v < 0) v += 60;
                return v % 60;
            });
            return;
        }
    }

    function onPointerDown(part: Part, value: number, e: React.PointerEvent) {
        e.preventDefault();
        setActivePart(part);
        dragInfo.current = { startY: e.clientY, orig: value, part };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
    function onPointerMove(e: React.PointerEvent) {
        if (!dragInfo.current) return;
        const { startY, part } = dragInfo.current;
        if (!part) return;
        const dy = startY - e.clientY;
        const step = part === 'startMinute' || part === 'endMinute' ? 5 : 1;
        const threshold = 28; // pixels per increment
        const units = Math.trunc(dy / threshold);
        if (Math.abs(units) >= 1) {
            adjust(part, units * step);
            dragInfo.current.startY =
                dragInfo.current.startY - units * threshold;
        }
    }
    function onPointerUp() {
        if (dragInfo.current) {
            dragInfo.current = null;
        }
    }

    async function handleSave() {
        setError(null);
        const token = localStorage.getItem('accessToken');
        if (isTokenExpired(token)) {
            setError('Sessão expirada');
            return;
        }
        // Validate start is in the future
        const startCandidate = new Date(
            `${date}T${String(startHour).padStart(2, '0')}:${String(
                startMinute,
            ).padStart(2, '0')}:00`,
        );
        if (startCandidate.getTime() < Date.now()) {
            setError('Horário inicial no passado');
            return;
        }
        setSaving(true);
        try {
            const startISO = new Date(
                `${date}T${String(startHour).padStart(2, '0')}:${String(
                    startMinute,
                ).padStart(2, '0')}:00`,
            ).toISOString();
            const endISO = new Date(
                `${date}T${String(endHour).padStart(2, '0')}:${String(
                    endMinute,
                ).padStart(2, '0')}:00`,
            ).toISOString();
            const isEdit = !!editingId;
            const url = isEdit
                ? `${API_BASE}/agenda/appointments/${editingId}/`
                : `${API_BASE}/agenda/appointments/`;
            const method = isEdit ? 'PATCH' : 'POST';
            const payload = isEdit
                ? { start_at: startISO, end_at: endISO }
                : {
                      client: client.id,
                      title: 'Consulta',
                      visit_type: 'consulta',
                      start_at: startISO,
                      end_at: endISO,
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
                const body = await r.text();
                throw new Error(body || 'Erro ao salvar');
            }
            setDirty(false);
            if (onSaved) onSaved();
            window.dispatchEvent(new CustomEvent('appointments:changed'));
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro desconhecido');
        } finally {
            setSaving(false);
        }
    }

    const timeDisplay = (
        <div className={styles.timeInline}>
            <Segment
                label='Início'
                hour={startHour}
                minute={startMinute}
                onPointerDown={onPointerDown}
                activePart={activePart}
                prefix='start'
            />
            <span className={styles.timeSep}>→</span>
            <Segment
                label='Fim'
                hour={endHour}
                minute={endMinute}
                onPointerDown={onPointerDown}
                activePart={activePart}
                prefix='end'
            />
        </div>
    );

    function Segment({
        label,
        hour,
        minute,
        onPointerDown,
        activePart,
        prefix,
    }: {
        label: string;
        hour: number;
        minute: number;
        onPointerDown: (p: Part, v: number, e: React.PointerEvent) => void;
        activePart: Part;
        prefix: 'start' | 'end';
    }) {
        const ah = activePart === (`${prefix}Hour` as Part);
        const am = activePart === (`${prefix}Minute` as Part);
        return (
            <div className={styles.segmentBlock}>
                <div className={styles.segmentLabel}>{label}</div>
                <div className={styles.segmentTime}>
                    <span
                        className={ah ? styles.segmentActive : styles.segment}
                        onPointerDown={e =>
                            onPointerDown(`${prefix}Hour` as Part, hour, e)
                        }
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onClick={() => {
                            setActivePart(`${prefix}Hour` as Part);
                        }}
                    >
                        {String(hour).padStart(2, '0')}
                    </span>
                    <span className={styles.colon}>:</span>
                    <span
                        className={am ? styles.segmentActive : styles.segment}
                        onPointerDown={e =>
                            onPointerDown(`${prefix}Minute` as Part, minute, e)
                        }
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onClick={() => {
                            setActivePart(`${prefix}Minute` as Part);
                        }}
                    >
                        {String(minute).padStart(2, '0')}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.compactContainer}>
            {activePart === 'date' && (
                <div className={styles.dateOverlayWrapper}>
                    <div className={styles.dateOverlay}>
                        <input
                            autoFocus
                            type='date'
                            value={date}
                            onChange={e => {
                                setDate(e.target.value);
                                markDirty();
                            }}
                            onBlur={() => setActivePart(null)}
                            className={styles.dateInline}
                        />
                    </div>
                </div>
            )}
            <div className={styles.rowCompact}>
                <button
                    type='button'
                    className={
                        activePart === 'date'
                            ? styles.dateButton + ' ' + styles.greenAccent
                            : styles.dateButton
                    }
                    onClick={() =>
                        setActivePart(activePart === 'date' ? null : 'date')
                    }
                >
                    {date.split('-').reverse().join('/')}
                </button>
            </div>
            {timeDisplay}
            {error && <div className={styles.error}>{error}</div>}
            {dirty && (
                <div className={styles.saveBar}>
                    <button
                        type='button'
                        className={styles.btnGhost}
                        onClick={() => {
                            // Cancelar descarta alterações (state local é perdido ao desmontar)
                            onClose();
                        }}
                        disabled={saving}
                    >
                        Cancelar
                    </button>
                    <button
                        type='button'
                        className={styles.btnPrimaryMini}
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? '...' : 'Salvar'}
                    </button>
                </div>
            )}
        </div>
    );
}
