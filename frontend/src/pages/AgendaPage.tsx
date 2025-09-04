import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useNow } from '../hooks/useNow';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    useAppointmentsRange,
    type Appointment,
} from '../hooks/useAppointments';
import { API_BASE } from '../config/api';
import { isTokenExpired } from '../utils/jwt';
import '../styles/palette.css';
// AgendaPage foi descontinuada e substituída por fluxos via modais (MiniScheduler/MonthlyAgendaModal) na Home.
export {};
function toISODate(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

function parseDateParam(s?: string | null) {
    if (!s) return new Date();
    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(s);
    if (!m) return new Date();
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function startOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}
function endOfDay(d: Date) {
    const x = startOfDay(d);
    x.setDate(x.getDate() + 1);
    return x;
}
function startOfWeekMonday(d: Date) {
    const x = startOfDay(d);
    const day = x.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    x.setDate(x.getDate() + diff);
    return x;
}
function endOfWeekMonday(d: Date) {
    const s = startOfWeekMonday(d);
    const e = new Date(s);
    e.setDate(e.getDate() + 7);
    return e;
}

function formatTime(dt: Date) {
    return dt.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    });
}
function toHHMM(dt: Date) {
    const h = String(dt.getHours()).padStart(2, '0');
    const m = String(dt.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}
function formatStatus(status: 'scheduled' | 'done' | 'canceled') {
    switch (status) {
        case 'scheduled':
            return 'Agendado';
        case 'done':
            return 'Realizado';
        case 'canceled':
            return 'Cancelado';
        default:
            return status;
    }
}
function formatDateBRWithWeekday(isoDate: string) {
    // Expecting YYYY-MM-DD
    const [y, m, d] = isoDate.split('-').map(n => Number(n));
    const dt = new Date(y, (m || 1) - 1, d || 1);
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();
    const weekday = PT_WEEKDAYS_LONG[dt.getDay()];
    return `${dd}/${mm}/${yyyy} - ${weekday}`;
}

const PT_WEEKDAYS_LONG = [
    'domingo',
    'segunda-feira',
    'terça-feira',
    'quarta-feira',
    'quinta-feira',
    'sexta-feira',
    'sábado',
];

type StatusFilter = 'all' | 'scheduled' | 'done' | 'canceled';

export default function AgendaPage() {
    // Lightweight ticker to refresh time-based UI every 30s (paused when tab hidden)
    const nowTick = useNow(30000);
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const [date, setDate] = useState<Date>(() =>
        parseDateParam(params.get('date')),
    );
    const [mode, setMode] = useState<'day' | 'week'>(
        () => (params.get('mode') as 'day' | 'week') || 'week',
    );
    const [reloadKey, setReloadKey] = useState(0);
    const { start, end } = useMemo(() => {
        if (mode === 'week') {
            return {
                start: startOfWeekMonday(date),
                end: endOfWeekMonday(date),
            };
        }
        return { start: startOfDay(date), end: endOfDay(date) };
    }, [date, mode]);
    const { items, loading } = useAppointmentsRange(
        start,
        end,
        undefined,
        reloadKey,
    );
    const [dayFilters, setDayFilters] = useState<Record<string, StatusFilter>>(
        () => {
            try {
                const raw = localStorage.getItem('agenda.details.filters');
                return raw
                    ? (JSON.parse(raw) as Record<string, StatusFilter>)
                    : {};
            } catch {
                return {};
            }
        },
    );

    const weekDays = useMemo(() => {
        if (mode !== 'week') return [] as Date[];
        const s = startOfWeekMonday(date);
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(s);
            d.setDate(s.getDate() + i);
            return d;
        });
    }, [date, mode]);

    const itemsByDay = useMemo(() => {
        const map: Record<string, Appointment[]> = {};
        items.forEach(a => {
            const d = new Date(a.start_at);
            const key = toISODate(d);
            if (!map[key]) map[key] = [];
            map[key].push(a);
        });
        Object.values(map).forEach(list =>
            list.sort(
                (a, b) =>
                    new Date(a.start_at).getTime() -
                    new Date(b.start_at).getTime(),
            ),
        );
        if (mode === 'day') {
            const k = toISODate(date);
            return { [k]: map[k] || [] } as Record<string, Appointment[]>;
        }
        weekDays.forEach(d => {
            const k = toISODate(d);
            if (!map[k]) map[k] = [];
        });
        return map;
    }, [items, mode, date, weekDays]);

    // Create modal state
    const [createModal, setCreateModal] = useState<{
        open: boolean;
        dayISO: string;
        start: string; // HH:MM
        end: string; // HH:MM
        title: string;
        visit_type: 'avaliacao' | 'retorno' | 'procedimento' | 'outro';
        notes: string;
        clientId?: number | null;
        clientName?: string;
        error?: string | null;
        saving?: boolean;
    }>({
        open: false,
        dayISO: toISODate(date),
        start: '',
        end: '',
        title: 'Consulta',
        visit_type: 'avaliacao',
        notes: '',
        clientId: null,
        clientName: '',
    });

    // Edit modal state
    const [editModal, setEditModal] = useState<{
        open: boolean;
        id: number | null;
        dayISO: string;
        start: string; // HH:MM
        end: string; // HH:MM
        title: string;
        visit_type: 'avaliacao' | 'retorno' | 'procedimento' | 'outro';
        notes: string;
        error?: string | null;
        saving?: boolean;
    }>({
        open: false,
        id: null,
        dayISO: toISODate(date),
        start: '',
        end: '',
        title: '',
        visit_type: 'avaliacao',
        notes: '',
    });

    function defaultTimesForDay(d: Date) {
        const now = new Date();
        // default to next whole hour from now if same day, else 09:00-10:00
        let h = 9;
        if (toISODate(now) === toISODate(d)) {
            h = now.getHours() + 1;
            if (h < 8) h = 8;
            if (h > 20) h = 20;
        }
        const start = `${String(h).padStart(2, '0')}:00`;
        const end = `${String(Math.min(h + 1, 21)).padStart(2, '0')}:00`;
        return { start, end };
    }

    const openCreate = useCallback((day: Date) => {
        // Allow prefill via URL ?start=HH:MM&end=HH:MM
        let start = defaultTimesForDay(day).start;
        let end = defaultTimesForDay(day).end;
        try {
            const url = new URL(window.location.href);
            const s = url.searchParams.get('start');
            const e = url.searchParams.get('end');
            if (s && /^\d{2}:\d{2}$/.test(s)) start = s;
            if (e && /^\d{2}:\d{2}$/.test(e)) end = e;
        } catch {
            /* ignore invalid URL */
        }
        // read client from URL to show in modal
        let clientId: number | null = null;
        let clientName = '';
        try {
            const url = new URL(window.location.href);
            const cid = url.searchParams.get('client');
            clientId = cid ? Number(cid) : null;
            // try reading pre-fetched name via localStorage set by Home (optional enhancement)
            if (clientId) {
                const label = localStorage.getItem(`client.name.${clientId}`);
                if (label) clientName = label;
            }
        } catch {
            /* noop */
        }
        setCreateModal({
            open: true,
            dayISO: toISODate(day),
            start,
            end,
            title: 'Consulta',
            visit_type: 'avaliacao',
            notes: '',
            clientId,
            clientName,
            error: null,
            saving: false,
        });
    }, []);

    function closeCreate() {
        setCreateModal(prev => ({ ...prev, open: false }));
    }

    function validateCreate() {
        const { dayISO, start, end } = createModal;
        if (!start || !end) return 'Informe início e fim.';
        const startDt = new Date(`${dayISO}T${start}:00`);
        const endDt = new Date(`${dayISO}T${end}:00`);
        if (!(startDt < endDt)) return 'Fim deve ser após o início.';
        const sameDayScheduled = items.filter(a => {
            const k = toISODate(new Date(a.start_at));
            return k === dayISO && a.status === 'scheduled';
        });
        for (const a of sameDayScheduled) {
            const s = new Date(a.start_at);
            const e = new Date(a.end_at);
            // half-open [start,end): overlap if newStart < e && newEnd > s
            if (startDt < e && endDt > s) {
                return 'Conflito com outro compromisso.';
            }
        }
        return null;
    }

    function validateEdit() {
        const { id, dayISO, start, end } = editModal;
        if (!id) return 'Agendamento inválido.';
        if (!start || !end) return 'Informe início e fim.';
        const startDt = new Date(`${dayISO}T${start}:00`);
        const endDt = new Date(`${dayISO}T${end}:00`);
        if (!(startDt < endDt)) return 'Fim deve ser após o início.';
        const sameDayScheduled = items.filter(a => {
            const k = toISODate(new Date(a.start_at));
            return k === dayISO && a.status === 'scheduled' && a.id !== id;
        });
        for (const a of sameDayScheduled) {
            const s = new Date(a.start_at);
            const e = new Date(a.end_at);
            if (startDt < e && endDt > s) {
                return 'Conflito com outro compromisso.';
            }
        }
        return null;
    }

    async function saveCreate() {
        const err = validateCreate();
        if (err) {
            setCreateModal(prev => ({ ...prev, error: err }));
            return;
        }
        const token = localStorage.getItem('accessToken');
        if (isTokenExpired(token)) {
            setCreateModal(prev => ({ ...prev, error: 'Sessão expirada.' }));
            return;
        }
        // prefer client from modal state (populated on open), fallback to URL
        const clientParam = params.get('client');
        const clientId =
            createModal.clientId ?? (clientParam ? Number(clientParam) : NaN);
        if (!clientId || Number.isNaN(clientId)) {
            setCreateModal(prev => ({
                ...prev,
                error: 'Selecione um cliente para o agendamento.',
            }));
            return;
        }
        const { dayISO, start, end, title, notes } = createModal;
        const startISO = new Date(`${dayISO}T${start}:00`).toISOString();
        const endISO = new Date(`${dayISO}T${end}:00`).toISOString();
        setCreateModal(prev => ({ ...prev, saving: true, error: null }));
        try {
            const r = await fetch(`${API_BASE}/agenda/appointments/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    client: clientId,
                    title: title || 'Consulta',
                    visit_type: 'outro',
                    start_at: startISO,
                    end_at: endISO,
                    notes: notes || '',
                    status: 'scheduled',
                }),
            });
            if (!r.ok) {
                const txt = await r.text();
                throw new Error(txt || 'Falha ao criar compromisso');
            }
            // success: close and reload
            setCreateModal(prev => ({ ...prev, open: false, saving: false }));
            setReloadKey(k => k + 1);
            // refresh Home clients list (next appointment data)
            try {
                void window.dispatchEvent(new Event('updateClients'));
            } catch (e) {
                void e;
            }
            // remove new=1 from URL if present (keep client and date)
            if (params.get('new') === '1') {
                params.delete('new');
                setParams(params, { replace: true });
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Erro ao criar.';
            setCreateModal(prev => ({ ...prev, saving: false, error: msg }));
        }
    }

    // Long-press and modal
    const pressTimerRef = useRef<number | null>(null);
    const longPressTriggeredRef = useRef<boolean>(false);
    const currentPressApptRef = useRef<Appointment | null>(null);
    const [actionModal, setActionModal] = useState<{
        open: boolean;
        appt?: Appointment;
    }>({ open: false });
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);
    const [localStatuses, setLocalStatuses] = useState<
        Record<number, Appointment['status']>
    >({});
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [pressedKey, setPressedKey] = useState<number | null>(null);
    const [pressedDayKey, setPressedDayKey] = useState<string | null>(null);
    const modalBoxRef = useRef<HTMLDivElement | null>(null);
    const firstBtnRef = useRef<HTMLButtonElement | null>(null);
    const prevFocusRef = useRef<HTMLElement | null>(null);
    const [modalAnim, setModalAnim] = useState(false);
    const overlayTouchStartY = useRef<number | null>(null);

    function openModal(appt: Appointment) {
        setActionModal({ open: true, appt });
        setSelectedId(appt.id);
        if (typeof navigator !== 'undefined') {
            const vib = (
                navigator as Navigator & {
                    vibrate?: (pattern: number | number[]) => boolean;
                }
            ).vibrate;
            if (typeof vib === 'function') vib(10);
        }
        // Clear any text selection that might have been triggered by long-press
        try {
            const sel =
                typeof window !== 'undefined' && window.getSelection
                    ? window.getSelection()
                    : null;
            if (sel && typeof sel.removeAllRanges === 'function')
                sel.removeAllRanges();
        } catch (e) {
            void e;
        }
        // Also blur the active element to avoid focus outlines
        try {
            const el = document.activeElement as HTMLElement | null;
            if (el && typeof el.blur === 'function') el.blur();
        } catch (e) {
            void e;
        }
    }
    function closeModal() {
        setActionModal({ open: false });
    }
    // Persist filters
    React.useEffect(() => {
        try {
            localStorage.setItem(
                'agenda.details.filters',
                JSON.stringify(dayFilters),
            );
        } catch (e) {
            void e;
        }
    }, [dayFilters]);

    // Modal lifecycle: animation, ESC to close, focus handling and focus trap
    React.useEffect(() => {
        if (!actionModal.open) return;
        prevFocusRef.current = (document.activeElement as HTMLElement) || null;
        setModalAnim(false);
        const raf = requestAnimationFrame(() => setModalAnim(true));
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeModal();
                return;
            }
            if (e.key === 'Tab' && modalBoxRef.current) {
                const focusables = Array.from(
                    modalBoxRef.current.querySelectorAll<HTMLElement>(
                        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
                    ),
                ).filter(el => !el.hasAttribute('disabled'));
                if (focusables.length === 0) return;
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                const active = document.activeElement as HTMLElement | null;
                if (e.shiftKey) {
                    if (
                        active === first ||
                        !modalBoxRef.current.contains(active)
                    ) {
                        e.preventDefault();
                        last.focus();
                    }
                } else {
                    if (active === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            }
        };
        window.addEventListener('keydown', onKey);
        const t = setTimeout(() => firstBtnRef.current?.focus(), 0);
        return () => {
            window.removeEventListener('keydown', onKey);
            cancelAnimationFrame(raf);
            clearTimeout(t);
            prevFocusRef.current?.focus?.();
        };
    }, [actionModal.open]);

    // Open create modal when ?new=1 arrives. If no client is set, redirect to Home in selection mode,
    // then come back to Agenda with client preselected to finalize.
    const newOpenedKeyRef = React.useRef<string | null>(null);
    React.useEffect(() => {
        const wantsNew = params.get('new') === '1';
        const dayParam = params.get('date');
        const clientParam = params.get('client');
        const key = `${dayParam || toISODate(date)}|${clientParam || ''}|${
            wantsNew ? '1' : ''
        }`;
        if (!wantsNew || newOpenedKeyRef.current === key || createModal.open) {
            return;
        }
        // If no client, go to Home selection mode with return URL back to Agenda
        if (!clientParam) {
            const d = parseDateParam(dayParam);
            const returnUrl = `/agenda?date=${toISODate(d)}&new=1`;
            try {
                window.location.href = `/?selectClientFor=agenda&return=${encodeURIComponent(
                    returnUrl,
                )}`;
            } catch (e) {
                void e;
            }
            return;
        }
        // Client is present: open the create modal now
        const d = parseDateParam(dayParam);
        openCreate(d);
        newOpenedKeyRef.current = key;
    }, [params, date, createModal.open, openCreate]);

    // Open edit modal when ?edit=<id> is present and the appointment is available
    const editOpenedIdRef = React.useRef<number | null>(null);
    React.useEffect(() => {
        const editParam = params.get('edit');
        const id = editParam ? Number(editParam) : NaN;
        if (!editParam || !Number.isFinite(id)) return;
        if (editOpenedIdRef.current === id) return;
        // Try to find appointment in current items
        const appt = items.find(a => a.id === id);
        if (appt) {
            const startDt = new Date(appt.start_at);
            const endDt = new Date(appt.end_at);
            setEditModal({
                open: true,
                id: appt.id,
                dayISO: toISODate(startDt),
                start: toHHMM(startDt),
                end: toHHMM(endDt),
                title: appt.title || '',
                visit_type: appt.visit_type || 'avaliacao',
                notes: appt.notes || '',
                error: null,
                saving: false,
            });
            editOpenedIdRef.current = id;
        }
    }, [params, items]);
    // removed legacy onPressStart (mouse/touch-specific handlers below)
    function onPressStartTouch(e: React.TouchEvent, appt: Appointment) {
        const t = e.touches[0];
        touchStartRef.current = { x: t.clientX, y: t.clientY };
        setPressedKey(appt.id);
        currentPressApptRef.current = appt;
        longPressTriggeredRef.current = false;
        setSelectedId(appt.id);
        if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
        pressTimerRef.current = window.setTimeout(() => {
            longPressTriggeredRef.current = true;
            openModal(appt);
        }, 550);
    }
    function onPressStartMouse(appt: Appointment) {
        setPressedKey(appt.id);
        currentPressApptRef.current = appt;
        longPressTriggeredRef.current = false;
        setSelectedId(appt.id);
        if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
        pressTimerRef.current = window.setTimeout(() => {
            longPressTriggeredRef.current = true;
            openModal(appt);
        }, 550);
    }
    function onPressEnd() {
        if (pressTimerRef.current) {
            window.clearTimeout(pressTimerRef.current);
            pressTimerRef.current = null;
        }
        touchStartRef.current = null;
        currentPressApptRef.current = null;
        longPressTriggeredRef.current = false;
        setPressedKey(null);
        // selection is immediate on press start; do not toggle on release
    }
    function onTouchMoveCheck(e: React.TouchEvent) {
        if (!touchStartRef.current) return;
        const t = e.touches[0];
        const dx = Math.abs(t.clientX - touchStartRef.current.x);
        const dy = Math.abs(t.clientY - touchStartRef.current.y);
        if (dx > 10 || dy > 10) {
            onPressEnd();
        }
    }
    function onKeyOpenModal(e: React.KeyboardEvent, appt: Appointment) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openModal(appt);
        }
    }
    async function cancelAppointment(appt?: Appointment) {
        if (!appt) return;
        const token = localStorage.getItem('accessToken');
        if (isTokenExpired(token)) {
            closeModal();
            return;
        }
        try {
            await fetch(`${API_BASE}/agenda/appointments/${appt.id}/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ status: 'canceled' }),
            });
            setLocalStatuses(prev => ({ ...prev, [appt.id]: 'canceled' }));
        } catch {
            // silent
        } finally {
            closeModal();
        }
    }
    function goToEdit(appt?: Appointment) {
        if (!appt) return;
        const day = toISODate(new Date(appt.start_at));
        closeModal();
        navigate(`/agenda?client=${appt.client}&date=${day}&edit=${appt.id}`);
    }

    function closeEdit() {
        setEditModal(prev => ({ ...prev, open: false }));
        // allow reopening the same id later
        editOpenedIdRef.current = null;
        if (params.get('edit')) {
            params.delete('edit');
            setParams(params, { replace: true });
        }
    }

    async function saveEdit() {
        const err = validateEdit();
        if (err) {
            setEditModal(prev => ({ ...prev, error: err }));
            return;
        }
        const token = localStorage.getItem('accessToken');
        if (isTokenExpired(token)) {
            setEditModal(prev => ({ ...prev, error: 'Sessão expirada.' }));
            return;
        }
        const { id, dayISO, start, end, title, notes } = editModal;
        if (!id) return;
        const startISO = new Date(`${dayISO}T${start}:00`).toISOString();
        const endISO = new Date(`${dayISO}T${end}:00`).toISOString();
        setEditModal(prev => ({ ...prev, saving: true, error: null }));
        try {
            const r = await fetch(`${API_BASE}/agenda/appointments/${id}/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    title: title || 'Consulta',
                    visit_type: 'outro',
                    start_at: startISO,
                    end_at: endISO,
                    notes: notes || '',
                }),
            });
            if (!r.ok) {
                const txt = await r.text();
                throw new Error(txt || 'Falha ao salvar compromisso');
            }
            setEditModal(prev => ({ ...prev, saving: false }));
            setReloadKey(k => k + 1);
            // refresh Home clients list (next appointment data)
            try {
                void window.dispatchEvent(new Event('updateClients'));
            } catch (e) {
                void e;
            }
            closeEdit();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Erro ao salvar.';
            setEditModal(prev => ({ ...prev, saving: false, error: msg }));
        }
    }

    return (
        <div
            style={{
                padding: '1rem',
                background: '#f6f8fb',
                minHeight: '100vh',
            }}
        >
            <div
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 5,
                    background: '#f6f8fb',
                    paddingBottom: 8,
                    marginBottom: 8,
                    borderBottom: '1px solid #e5e7eb',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                    }}
                >
                    <h3
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
                        <span>Compromissos</span>
                    </h3>
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
                            onClick={() => navigate('/')}
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
                        marginTop: 8,
                    }}
                >
                    <input
                        type='date'
                        value={toISODate(date)}
                        onChange={e => {
                            const val = e.target.value;
                            const d = parseDateParam(val);
                            setDate(d);
                            params.set('date', toISODate(d));
                            setParams(params, { replace: true });
                            // scroll to the day card just below the header
                            const dayKey = toISODate(d);
                            // find element with data-day attribute
                            requestAnimationFrame(() => {
                                const el = document.querySelector(
                                    `[data-day="${dayKey}"]`,
                                ) as HTMLElement | null;
                                if (el) {
                                    const header = document.querySelector(
                                        'div[style*="position: sticky"]',
                                    ) as HTMLElement | null;
                                    const headerH = header?.offsetHeight || 0;
                                    const y =
                                        el.getBoundingClientRect().top +
                                        window.scrollY -
                                        headerH -
                                        8;
                                    window.scrollTo({
                                        top: y,
                                        behavior: 'smooth',
                                    });
                                }
                            });
                        }}
                        style={{ padding: 6 }}
                    />
                    <select
                        value={mode}
                        onChange={e => {
                            const v = e.target.value as 'day' | 'week';
                            setMode(v);
                            params.set('mode', v);
                            setParams(params, { replace: true });
                        }}
                    >
                        <option value='day'>Dia</option>
                        <option value='week'>Semana</option>
                    </select>
                    <button
                        onClick={() => {
                            const dayISO = toISODate(date);
                            const returnUrl = `/agenda?date=${dayISO}&new=1`;
                            window.location.href = `/?selectClientFor=agenda&return=${encodeURIComponent(
                                returnUrl,
                            )}`;
                        }}
                        title='Novo compromisso neste dia'
                        style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: '1px solid #e5e7eb',
                            background: '#ffffff',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                        }}
                    >
                        ＋ Novo
                    </button>
                </div>
            </div>

            {loading ? (
                <div>Carregando…</div>
            ) : mode === 'week' ? (
                <div style={{ display: 'grid', gap: 10 }}>
                    {weekDays.map(d => {
                        const key = toISODate(d);
                        const list = itemsByDay[key] || [];
                        const filter = dayFilters[key] ?? 'all';
                        const filtered =
                            filter === 'all'
                                ? list
                                : list.filter(a => a.status === filter);
                        const weekday = d.getDay();
                        return (
                            <div
                                key={key}
                                data-day={key}
                                style={{
                                    border:
                                        pressedDayKey === key
                                            ? '1px solid #c7d2fe'
                                            : '1px solid #d1d5db',
                                    borderRadius: 10,
                                    padding: 12,
                                    background:
                                        pressedDayKey === key
                                            ? '#eef2ff'
                                            : '#fbfdff',
                                    boxShadow:
                                        pressedDayKey === key
                                            ? '0 3px 6px rgba(0,0,0,0.10)'
                                            : '0 2px 4px rgba(0,0,0,0.08)',
                                    transition:
                                        'background 120ms ease, box-shadow 120ms ease, border-color 120ms ease',
                                }}
                                onTouchStart={() => setPressedDayKey(key)}
                                onTouchEnd={() => setPressedDayKey(null)}
                                onMouseDown={() => setPressedDayKey(key)}
                                onMouseUp={() => setPressedDayKey(null)}
                                onMouseLeave={() => setPressedDayKey(null)}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'baseline',
                                        justifyContent: 'space-between',
                                        gap: 8,
                                    }}
                                >
                                    <div>
                                        <div
                                            style={{
                                                fontSize: 16,
                                                color: '#6b7280',
                                                fontWeight: 600,
                                            }}
                                        >
                                            {PT_WEEKDAYS_LONG[weekday]}
                                        </div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                flexWrap: 'wrap',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontWeight: 700,
                                                    fontSize: 18,
                                                }}
                                            >
                                                {String(d.getDate()).padStart(
                                                    2,
                                                    '0',
                                                )}
                                                /
                                                {String(
                                                    d.getMonth() + 1,
                                                ).padStart(2, '0')}
                                                /{d.getFullYear()}
                                            </div>
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'flex-end',
                                            gap: 6,
                                        }}
                                    >
                                        <button
                                            onClick={() => {
                                                const dayISO = toISODate(d);
                                                const returnUrl = `/agenda?date=${dayISO}&new=1`;
                                                window.location.href = `/?selectClientFor=agenda&return=${encodeURIComponent(
                                                    returnUrl,
                                                )}`;
                                            }}
                                            aria-label={`Novo compromisso em ${key}`}
                                            title='Novo compromisso'
                                            style={{
                                                padding: '4px 8px',
                                                borderRadius: 8,
                                                border: '1px solid #e5e7eb',
                                                background: '#ffffff',
                                                boxShadow:
                                                    '0 1px 2px rgba(0,0,0,0.03)',
                                                marginBottom: 4,
                                            }}
                                        >
                                            ＋
                                        </button>
                                        <select
                                            value={filter}
                                            onChange={e =>
                                                setDayFilters(prev => ({
                                                    ...prev,
                                                    [key]: e.target
                                                        .value as StatusFilter,
                                                }))
                                            }
                                            style={{
                                                fontSize: 14,
                                                padding: '4px 6px',
                                            }}
                                            aria-label={`Filtro do dia ${String(
                                                d.getDate(),
                                            ).padStart(2, '0')}/${String(
                                                d.getMonth() + 1,
                                            ).padStart(
                                                2,
                                                '0',
                                            )}/${d.getFullYear()}`}
                                        >
                                            <option value='all'>Todos</option>
                                            <option value='scheduled'>
                                                Agendado
                                            </option>
                                            <option value='done'>
                                                Realizado
                                            </option>
                                            <option value='canceled'>
                                                Cancelado
                                            </option>
                                        </select>
                                        <div
                                            style={{
                                                fontSize: 14,
                                                fontWeight: 700,
                                                color: '#374151',
                                                whiteSpace: 'nowrap',
                                            }}
                                            aria-label={`Compromissos: ${filtered.length}`}
                                        >
                                            <span style={{ fontWeight: 700 }}>
                                                {filtered.length}
                                            </span>{' '}
                                            {filtered.length === 1
                                                ? 'compromisso'
                                                : 'compromissos'}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ marginTop: 8 }}>
                                    {filtered.length ? (
                                        <ul
                                            style={{
                                                listStyle: 'none',
                                                padding: 0,
                                                margin: 0,
                                                display: 'grid',
                                                gap: 8,
                                            }}
                                        >
                                            {filtered.map(a => {
                                                const start = new Date(
                                                    a.start_at,
                                                );
                                                const end = new Date(a.end_at);
                                                const currentStatus =
                                                    localStatuses[a.id] ??
                                                    a.status;
                                                const statusText =
                                                    formatStatus(currentStatus);
                                                const statusColor =
                                                    currentStatus === 'canceled'
                                                        ? '#b91c1c'
                                                        : currentStatus ===
                                                          'done'
                                                        ? '#065f46'
                                                        : '#059669';
                                                const statusBg =
                                                    currentStatus === 'canceled'
                                                        ? '#fef2f2'
                                                        : currentStatus ===
                                                          'done'
                                                        ? '#ecfdf5'
                                                        : '#f0fdf4';
                                                const now = nowTick;
                                                const isExpired =
                                                    currentStatus ===
                                                        'scheduled' &&
                                                    end.getTime() <=
                                                        now.getTime();
                                                const isOngoing =
                                                    currentStatus ===
                                                        'scheduled' &&
                                                    start.getTime() <=
                                                        now.getTime() &&
                                                    now.getTime() <
                                                        end.getTime();
                                                let cardColor = statusColor;
                                                let cardBg = statusBg;
                                                if (isExpired) {
                                                    cardColor = '#6b7280'; // gray-500
                                                    cardBg = '#f3f4f6'; // gray-100
                                                } else if (isOngoing) {
                                                    cardColor = '#b45309'; // amber-700 (darker)
                                                    cardBg = '#fffbeb'; // amber-50 (lighter)
                                                }
                                                const displayStatusText =
                                                    isExpired
                                                        ? 'Vencido'
                                                        : isOngoing
                                                        ? 'Em Atendimento'
                                                        : statusText;
                                                return (
                                                    <li
                                                        key={a.id}
                                                        role='button'
                                                        tabIndex={0}
                                                        onKeyDown={e =>
                                                            onKeyOpenModal(e, a)
                                                        }
                                                        onTouchStart={e =>
                                                            onPressStartTouch(
                                                                e,
                                                                a,
                                                            )
                                                        }
                                                        onTouchEnd={() =>
                                                            onPressEnd()
                                                        }
                                                        onTouchMove={
                                                            onTouchMoveCheck
                                                        }
                                                        onMouseDown={e => {
                                                            if (
                                                                e.button === 0
                                                            ) {
                                                                e.preventDefault();
                                                                onPressStartMouse(
                                                                    a,
                                                                );
                                                            }
                                                        }}
                                                        onMouseUp={() =>
                                                            onPressEnd()
                                                        }
                                                        onMouseLeave={() =>
                                                            onPressEnd()
                                                        }
                                                        onContextMenu={e =>
                                                            e.preventDefault()
                                                        }
                                                        style={{
                                                            padding: '10px 8px',
                                                            border: `${
                                                                pressedKey ===
                                                                    a.id ||
                                                                selectedId ===
                                                                    a.id
                                                                    ? 2
                                                                    : 1
                                                            }px solid ${cardColor}`,
                                                            display: 'grid',
                                                            gap: 2,
                                                            background: cardBg,
                                                            borderRadius: 8,
                                                            paddingLeft: 14,
                                                            position:
                                                                'relative',
                                                            overflow: 'hidden',
                                                            userSelect: 'none',
                                                            WebkitUserSelect:
                                                                'none',
                                                            boxShadow:
                                                                '0 1px 2px rgba(0,0,0,0.03)',
                                                        }}
                                                    >
                                                        <div
                                                            aria-hidden='true'
                                                            style={{
                                                                position:
                                                                    'absolute',
                                                                left: 0,
                                                                top: 0,
                                                                bottom: 0,
                                                                width: 4,
                                                                background:
                                                                    cardColor,
                                                            }}
                                                        />
                                                        <div
                                                            style={{
                                                                display: 'flex',
                                                                alignItems:
                                                                    'baseline',
                                                                justifyContent:
                                                                    'space-between',
                                                                gap: 8,
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    fontWeight: 600,
                                                                    color: isOngoing
                                                                        ? cardColor
                                                                        : undefined,
                                                                }}
                                                            >
                                                                {formatTime(
                                                                    start,
                                                                )}{' '}
                                                                a{' '}
                                                                {formatTime(
                                                                    end,
                                                                )}{' '}
                                                                - {a.title}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    fontSize: 12,
                                                                    color: cardColor,
                                                                    whiteSpace:
                                                                        'nowrap',
                                                                }}
                                                            >
                                                                {
                                                                    displayStatusText
                                                                }
                                                            </div>
                                                        </div>
                                                        <div
                                                            style={{
                                                                color: isOngoing
                                                                    ? cardColor
                                                                    : '#111827',
                                                                fontWeight:
                                                                    isOngoing
                                                                        ? 600
                                                                        : 400,
                                                            }}
                                                        >
                                                            {a.client_name ||
                                                                '—'}
                                                        </div>
                                                        {a.notes ? (
                                                            <div
                                                                style={{
                                                                    color: isOngoing
                                                                        ? cardColor
                                                                        : '#4b5563',
                                                                    fontSize: 12,
                                                                }}
                                                            >
                                                                {a.notes}
                                                            </div>
                                                        ) : null}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    ) : (
                                        <div
                                            style={{
                                                color: '#6b7280',
                                                fontSize: 13,
                                            }}
                                        >
                                            Nenhum agendamento.
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div data-day={toISODate(date)}>
                    {(() => {
                        const k = toISODate(date);
                        const list = itemsByDay[k] || [];
                        return list.length ? (
                            <ul
                                style={{
                                    listStyle: 'none',
                                    padding: 0,
                                    margin: 0,
                                    display: 'grid',
                                    gap: 8,
                                }}
                            >
                                {list.map(a => {
                                    const start = new Date(a.start_at);
                                    const end = new Date(a.end_at);
                                    const currentStatus =
                                        localStatuses[a.id] ?? a.status;
                                    const statusText =
                                        formatStatus(currentStatus);
                                    const statusColor =
                                        currentStatus === 'canceled'
                                            ? '#b91c1c'
                                            : currentStatus === 'done'
                                            ? '#065f46'
                                            : '#059669';
                                    const statusBg =
                                        currentStatus === 'canceled'
                                            ? '#fef2f2'
                                            : currentStatus === 'done'
                                            ? '#ecfdf5'
                                            : '#f0fdf4';
                                    const now = nowTick;
                                    const isExpired =
                                        currentStatus === 'scheduled' &&
                                        end.getTime() <= now.getTime();
                                    const isOngoing =
                                        currentStatus === 'scheduled' &&
                                        start.getTime() <= now.getTime() &&
                                        now.getTime() < end.getTime();
                                    let cardColor = statusColor;
                                    let cardBg = statusBg;
                                    if (isExpired) {
                                        cardColor = '#6b7280'; // gray-500
                                        cardBg = '#f3f4f6'; // gray-100
                                    } else if (isOngoing) {
                                        cardColor = '#b45309'; // amber-700 (darker)
                                        cardBg = '#fffbeb'; // amber-50 (lighter)
                                    }
                                    const displayStatusText = isExpired
                                        ? 'Vencido'
                                        : isOngoing
                                        ? 'Em Atendimento'
                                        : statusText;
                                    return (
                                        <li
                                            key={a.id}
                                            role='button'
                                            tabIndex={0}
                                            onKeyDown={e =>
                                                onKeyOpenModal(e, a)
                                            }
                                            onTouchStart={e =>
                                                onPressStartTouch(e, a)
                                            }
                                            onTouchEnd={() => onPressEnd()}
                                            onTouchMove={onTouchMoveCheck}
                                            onMouseDown={e => {
                                                if (e.button === 0) {
                                                    e.preventDefault();
                                                    onPressStartMouse(a);
                                                }
                                            }}
                                            onMouseUp={() => onPressEnd()}
                                            onMouseLeave={() => onPressEnd()}
                                            onContextMenu={e =>
                                                e.preventDefault()
                                            }
                                            style={{
                                                padding: '10px 8px',
                                                border: `${
                                                    pressedKey === a.id ||
                                                    selectedId === a.id
                                                        ? 2
                                                        : 1
                                                }px solid ${cardColor}`,
                                                display: 'grid',
                                                gap: 2,
                                                background: cardBg,
                                                borderRadius: 8,
                                                paddingLeft: 14,
                                                position: 'relative',
                                                overflow: 'hidden',
                                                userSelect: 'none',
                                                WebkitUserSelect: 'none',
                                                boxShadow:
                                                    '0 1px 2px rgba(0,0,0,0.03)',
                                            }}
                                        >
                                            <div
                                                aria-hidden='true'
                                                style={{
                                                    position: 'absolute',
                                                    left: 0,
                                                    top: 0,
                                                    bottom: 0,
                                                    width: 4,
                                                    background: cardColor,
                                                }}
                                            />
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'baseline',
                                                    justifyContent:
                                                        'space-between',
                                                    gap: 8,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        fontWeight: 600,
                                                        color: isOngoing
                                                            ? cardColor
                                                            : undefined,
                                                    }}
                                                >
                                                    {formatTime(start)} a{' '}
                                                    {formatTime(end)} -{' '}
                                                    {a.title}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 12,
                                                        color: cardColor,
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {displayStatusText}
                                                </div>
                                            </div>
                                            <div
                                                style={{
                                                    color: isOngoing
                                                        ? cardColor
                                                        : '#111827',
                                                    fontWeight: isOngoing
                                                        ? 600
                                                        : 400,
                                                }}
                                            >
                                                {a.client_name || '—'}
                                            </div>
                                            {a.notes ? (
                                                <div
                                                    style={{
                                                        color: isOngoing
                                                            ? cardColor
                                                            : '#4b5563',
                                                        fontSize: 12,
                                                    }}
                                                >
                                                    {a.notes}
                                                </div>
                                            ) : null}
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <div>Nenhum agendamento.</div>
                        );
                    })()}
                </div>
            )}

            {actionModal.open && (
                <div
                    role='dialog'
                    aria-modal='true'
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 16,
                        zIndex: 50,
                    }}
                    onClick={closeModal}
                    onTouchStart={e => {
                        overlayTouchStartY.current =
                            e.touches[0]?.clientY ?? null;
                    }}
                    onTouchMove={e => {
                        if (overlayTouchStartY.current == null) return;
                        const dy =
                            e.touches[0].clientY - overlayTouchStartY.current;
                        if (dy > 40) {
                            closeModal();
                            overlayTouchStartY.current = null;
                        }
                    }}
                >
                    <div
                        style={{
                            background: '#fff',
                            borderRadius: 12,
                            width: '100%',
                            maxWidth: 360,
                            boxShadow: '0 10px 20px rgba(0,0,0,0.15)',
                            overflow: 'hidden',
                            opacity: modalAnim ? 1 : 0,
                            transform: modalAnim
                                ? 'translateY(0) scale(1)'
                                : 'translateY(10px) scale(0.98)',
                            transition:
                                'opacity 140ms ease, transform 140ms ease',
                        }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                        <div
                            style={{
                                padding: 16,
                                borderBottom: '1px solid #e5e7eb',
                            }}
                        >
                            <div style={{ fontWeight: 700, marginBottom: 2 }}>
                                O que deseja fazer com este compromisso?
                            </div>
                        </div>
                        <div style={{ display: 'grid' }}>
                            <button
                                onClick={() => goToEdit(actionModal.appt)}
                                style={{
                                    padding: 14,
                                    textAlign: 'left',
                                    background: 'white',
                                    border: 'none',
                                    borderBottom: '1px solid #e5e7eb',
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 16,
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                    }}
                                >
                                    <span aria-hidden='true'>✏️</span>
                                    <span>Editar</span>
                                </div>
                                <div style={{ fontSize: 13, color: '#6b7280' }}>
                                    (alterar data / hora)
                                </div>
                            </button>
                            <button
                                onClick={() =>
                                    cancelAppointment(actionModal.appt)
                                }
                                style={{
                                    padding: 14,
                                    textAlign: 'left',
                                    background: 'white',
                                    border: 'none',
                                    borderBottom: '1px solid #e5e7eb',
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 16,
                                        fontWeight: 600,
                                        color: '#b91c1c',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                    }}
                                >
                                    <span aria-hidden='true'>❌</span>
                                    <span>Cancelar</span>
                                </div>
                                <div style={{ fontSize: 13, color: '#9ca3af' }}>
                                    (cancelar esta agenda)
                                </div>
                            </button>
                            <button
                                onClick={closeModal}
                                style={{
                                    padding: 14,
                                    textAlign: 'left',
                                    background: 'white',
                                    border: 'none',
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 16,
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                    }}
                                >
                                    <span aria-hidden='true'>✅</span>
                                    <span>Ok</span>
                                </div>
                                <div style={{ fontSize: 13, color: '#6b7280' }}>
                                    (retornar)
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {createModal.open && (
                <div
                    role='dialog'
                    aria-modal='true'
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 16,
                        zIndex: 60,
                    }}
                    onClick={closeCreate}
                >
                    <div
                        style={{
                            background: '#fff',
                            borderRadius: 12,
                            width: '100%',
                            maxWidth: 380,
                            boxShadow: '0 10px 20px rgba(0,0,0,0.15)',
                            overflow: 'hidden',
                        }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                        <div
                            style={{
                                padding: 16,
                                borderBottom: '1px solid #e5e7eb',
                            }}
                        >
                            <div style={{ fontWeight: 800, fontSize: 18 }}>
                                Novo compromisso
                            </div>
                            <div
                                style={{
                                    color: '#111827',
                                    fontSize: 14,
                                    fontWeight: 600,
                                }}
                            >
                                {formatDateBRWithWeekday(createModal.dayISO)}
                            </div>
                            {createModal.clientId ? (
                                <div
                                    style={{
                                        color: '#374151',
                                        fontSize: 13,
                                        marginTop: 4,
                                    }}
                                >
                                    Cliente: {createModal.clientName || ''}
                                    {createModal.clientName
                                        ? ''
                                        : `#${createModal.clientId}`}
                                </div>
                            ) : null}
                        </div>
                        <div style={{ display: 'grid', gap: 12, padding: 16 }}>
                            <label style={{ display: 'grid', gap: 6 }}>
                                <span
                                    style={{ fontSize: 13, color: '#374151' }}
                                >
                                    Título (Tipo de consulta)
                                </span>
                                <input
                                    type='text'
                                    value={createModal.title}
                                    onChange={e =>
                                        setCreateModal(prev => ({
                                            ...prev,
                                            title: e.target.value,
                                        }))
                                    }
                                    placeholder='Consulta'
                                    style={{
                                        padding: 8,
                                        borderRadius: 8,
                                        border: '1px solid #e5e7eb',
                                    }}
                                />
                            </label>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: 12,
                                }}
                            >
                                <label style={{ display: 'grid', gap: 6 }}>
                                    <span
                                        style={{
                                            fontSize: 13,
                                            color: '#374151',
                                        }}
                                    >
                                        Início
                                    </span>
                                    <input
                                        type='time'
                                        value={createModal.start}
                                        onChange={e =>
                                            setCreateModal(prev => ({
                                                ...prev,
                                                start: e.target.value,
                                            }))
                                        }
                                        step={300}
                                        style={{
                                            padding: 8,
                                            borderRadius: 8,
                                            border: '1px solid #e5e7eb',
                                        }}
                                    />
                                </label>
                                <label style={{ display: 'grid', gap: 6 }}>
                                    <span
                                        style={{
                                            fontSize: 13,
                                            color: '#374151',
                                        }}
                                    >
                                        Fim
                                    </span>
                                    <input
                                        type='time'
                                        value={createModal.end}
                                        onChange={e =>
                                            setCreateModal(prev => ({
                                                ...prev,
                                                end: e.target.value,
                                            }))
                                        }
                                        step={300}
                                        style={{
                                            padding: 8,
                                            borderRadius: 8,
                                            border: '1px solid #e5e7eb',
                                        }}
                                    />
                                </label>
                            </div>
                            <label style={{ display: 'grid', gap: 6 }}>
                                <span
                                    style={{ fontSize: 13, color: '#374151' }}
                                >
                                    Observações
                                </span>
                                <textarea
                                    value={createModal.notes}
                                    onChange={e =>
                                        setCreateModal(prev => ({
                                            ...prev,
                                            notes: e.target.value,
                                        }))
                                    }
                                    placeholder='Escreva qualquer observação...'
                                    rows={3}
                                    style={{
                                        padding: 8,
                                        borderRadius: 8,
                                        border: '1px solid #e5e7eb',
                                    }}
                                />
                            </label>
                            {createModal.error && (
                                <div style={{ color: '#b91c1c', fontSize: 13 }}>
                                    {createModal.error}
                                </div>
                            )}
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: 8,
                                padding: 16,
                                borderTop: '1px solid #e5e7eb',
                            }}
                        >
                            <button
                                onClick={closeCreate}
                                disabled={!!createModal.saving}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: 8,
                                    border: '1px solid #e5e7eb',
                                    background: '#fff',
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={saveCreate}
                                disabled={!!createModal.saving}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: 8,
                                    border: '1px solid #059669',
                                    background: '#10b981',
                                    color: '#fff',
                                }}
                            >
                                {createModal.saving ? 'Salvando…' : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editModal.open && (
                <div
                    role='dialog'
                    aria-modal='true'
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 16,
                        zIndex: 65,
                    }}
                    onClick={closeEdit}
                >
                    <div
                        style={{
                            background: '#fff',
                            borderRadius: 12,
                            width: '100%',
                            maxWidth: 420,
                            boxShadow: '0 10px 20px rgba(0,0,0,0.15)',
                            overflow: 'hidden',
                        }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                        <div
                            style={{
                                padding: 16,
                                borderBottom: '1px solid #e5e7eb',
                            }}
                        >
                            <div style={{ fontWeight: 700 }}>
                                Editar compromisso
                            </div>
                            <div style={{ color: '#6b7280', fontSize: 13 }}>
                                {editModal.dayISO}
                            </div>
                        </div>
                        <div style={{ display: 'grid', gap: 12, padding: 16 }}>
                            <label style={{ display: 'grid', gap: 6 }}>
                                <span
                                    style={{ fontSize: 13, color: '#374151' }}
                                >
                                    Data
                                </span>
                                <input
                                    type='date'
                                    value={editModal.dayISO}
                                    onChange={e =>
                                        setEditModal(prev => ({
                                            ...prev,
                                            dayISO: e.target.value,
                                        }))
                                    }
                                    style={{
                                        padding: 8,
                                        borderRadius: 8,
                                        border: '1px solid #e5e7eb',
                                    }}
                                />
                            </label>
                            <label style={{ display: 'grid', gap: 6 }}>
                                <span
                                    style={{ fontSize: 13, color: '#374151' }}
                                >
                                    Título (Tipo de consulta)
                                </span>
                                <input
                                    type='text'
                                    value={editModal.title}
                                    onChange={e =>
                                        setEditModal(prev => ({
                                            ...prev,
                                            title: e.target.value,
                                        }))
                                    }
                                    placeholder='Consulta'
                                    style={{
                                        padding: 8,
                                        borderRadius: 8,
                                        border: '1px solid #e5e7eb',
                                    }}
                                />
                            </label>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: 12,
                                }}
                            >
                                <label style={{ display: 'grid', gap: 6 }}>
                                    <span
                                        style={{
                                            fontSize: 13,
                                            color: '#374151',
                                        }}
                                    >
                                        Início
                                    </span>
                                    <input
                                        type='time'
                                        value={editModal.start}
                                        onChange={e =>
                                            setEditModal(prev => ({
                                                ...prev,
                                                start: e.target.value,
                                            }))
                                        }
                                        step={300}
                                        style={{
                                            padding: 8,
                                            borderRadius: 8,
                                            border: '1px solid #e5e7eb',
                                        }}
                                    />
                                </label>
                                <label style={{ display: 'grid', gap: 6 }}>
                                    <span
                                        style={{
                                            fontSize: 13,
                                            color: '#374151',
                                        }}
                                    >
                                        Fim
                                    </span>
                                    <input
                                        type='time'
                                        value={editModal.end}
                                        onChange={e =>
                                            setEditModal(prev => ({
                                                ...prev,
                                                end: e.target.value,
                                            }))
                                        }
                                        step={300}
                                        style={{
                                            padding: 8,
                                            borderRadius: 8,
                                            border: '1px solid #e5e7eb',
                                        }}
                                    />
                                </label>
                            </div>
                            <label style={{ display: 'grid', gap: 6 }}>
                                <span
                                    style={{ fontSize: 13, color: '#374151' }}
                                >
                                    Observações
                                </span>
                                <textarea
                                    value={editModal.notes}
                                    onChange={e =>
                                        setEditModal(prev => ({
                                            ...prev,
                                            notes: e.target.value,
                                        }))
                                    }
                                    placeholder='Escreva qualquer observação...'
                                    rows={3}
                                    style={{
                                        padding: 8,
                                        borderRadius: 8,
                                        border: '1px solid #e5e7eb',
                                    }}
                                />
                            </label>
                            {editModal.error && (
                                <div style={{ color: '#b91c1c', fontSize: 13 }}>
                                    {editModal.error}
                                </div>
                            )}
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: 8,
                                padding: 16,
                                borderTop: '1px solid #e5e7eb',
                            }}
                        >
                            <button
                                onClick={closeEdit}
                                disabled={!!editModal.saving}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: 8,
                                    border: '1px solid #e5e7eb',
                                    background: '#fff',
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={saveEdit}
                                disabled={!!editModal.saving}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: 8,
                                    border: '1px solid #059669',
                                    background: '#10b981',
                                    color: '#fff',
                                }}
                            >
                                {editModal.saving ? 'Salvando…' : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
