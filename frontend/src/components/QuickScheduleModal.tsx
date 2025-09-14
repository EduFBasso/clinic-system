import React from 'react';
import TimePicker10 from './TimePicker10';
import AppModal from './Modal';
import type { ClientBasic } from '../types/ClientBasic';
import type { Appointment } from '../hooks/useAppointments';
import { API_BASE } from '../config/api';
import FloatingDatePicker from './FloatingDatePicker';
import { FaCalendarAlt } from 'react-icons/fa';
import AppointmentCard from './AppointmentCard';
import { useAppointmentsRange } from '../hooks/useAppointments';
import { AUTO_CLOSE_QUICK_SCHEDULE_ON_CREATE } from '../config/limits';

function pad2(n: number) {
    return String(n).padStart(2, '0');
}

function toDateStr(d: Date) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function weekdayLabel(d: Date) {
    const s = d
        .toLocaleDateString('pt-BR', { weekday: 'short' })
        .replace('.', '');
    return s.charAt(0).toUpperCase() + s.slice(1);
}

interface QuickScheduleModalProps {
    open: boolean;
    onClose: () => void;
    client: ClientBasic;
    editAppointment?: Appointment | null;
    afterPersist?: (id: number | null, mode: 'created' | 'updated') => void;
    futureAppointments?: Appointment[];
    maxFutureAppointments?: number;
}

export default function QuickScheduleModal({
    open,
    onClose,
    client,
    editAppointment,
    afterPersist,
    futureAppointments = [],
    maxFutureAppointments = 7,
}: QuickScheduleModalProps) {
    const [expanded, setExpanded] = React.useState(false);
    const [currentEdit, setCurrentEdit] = React.useState<
        Appointment | null | undefined
    >(editAppointment);
    React.useEffect(() => setCurrentEdit(editAppointment), [editAppointment]);

    const isEdit = !!(currentEdit && currentEdit.id);
    const baseDate = React.useMemo(() => {
        if (isEdit && currentEdit) return new Date(currentEdit.start_at);
        // Regra: sempre sugerir criação para +7 dias a partir de agora.
        const d = new Date();
        d.setSeconds(0, 0);
        d.setDate(d.getDate() + 7);
        return d;
    }, [isEdit, currentEdit]);

    const [startHM, setStartHM] = React.useState(() => {
        const d = new Date(baseDate);
        return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    });
    const [endHM, setEndHM] = React.useState(() => {
        if (isEdit && currentEdit) {
            const e = new Date(currentEdit.end_at);
            return `${pad2(e.getHours())}:${pad2(e.getMinutes())}`;
        }
        const d = new Date(baseDate);
        d.setMinutes(d.getMinutes() + 60);
        return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    });
    const MIN_DURATION_MIN = 60;
    // helper convert HH:MM to minutes from midnight
    function toMinutes(hm: string) {
        const [h, m] = hm.split(':').map(n => parseInt(n, 10));
        return h * 60 + m;
    }
    function fromMinutes(total: number) {
        const h = Math.floor(total / 60);
        const m = total % 60;
        return `${pad2(h)}:${pad2(m)}`;
    }
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [showPicker, setShowPicker] = React.useState(false);
    const [selectedDate, setSelectedDate] = React.useState<Date>(baseDate);
    const [visitType, setVisitType] = React.useState<
        'avaliacao' | 'retorno' | 'procedimento' | 'outro' | 'consulta'
    >((): 'avaliacao' | 'retorno' | 'procedimento' | 'outro' | 'consulta' => {
        const raw = localStorage.getItem('defaultVisitType');
        if (
            raw === 'avaliacao' ||
            raw === 'retorno' ||
            raw === 'procedimento' ||
            raw === 'outro' ||
            raw === 'consulta'
        ) {
            return raw;
        }
        // inválido ou ausente -> definir 'consulta' como novo padrão persistido
        try {
            localStorage.setItem('defaultVisitType', 'consulta');
        } catch {
            /* noop */
        }
        return 'consulta';
    });
    const [setDefaultVisitType, setSetDefaultVisitType] = React.useState(false);
    const [notes, setNotes] = React.useState('');

    React.useEffect(() => {
        if (!open) return;
        setError(null);
        if (!isEdit && futureAppointments.length >= maxFutureAppointments) {
            try {
                window.dispatchEvent(
                    new CustomEvent('systemMessage', {
                        detail: {
                            text: `Limite de ${maxFutureAppointments} compromissos futuros atingido para este cliente`,
                            type: 'warning',
                        },
                    }),
                );
            } catch {
                /* noop: falha em disparar mensagem global */
            }
        }
    }, [open, isEdit, futureAppointments.length, maxFutureAppointments]);

    React.useEffect(() => {
        // Sync selected date when baseDate changes (e.g., switching edit target)
        setSelectedDate(baseDate);
    }, [baseDate]);

    // When currentEdit changes while modal is open, prefill times and notes
    React.useEffect(() => {
        if (currentEdit) {
            const sd = new Date(currentEdit.start_at);
            const ed = new Date(currentEdit.end_at);
            setSelectedDate(sd);
            setStartHM(`${pad2(sd.getHours())}:${pad2(sd.getMinutes())}`);
            setEndHM(`${pad2(ed.getHours())}:${pad2(ed.getMinutes())}`);
            setNotes(currentEdit.notes || '');
        }
    }, [currentEdit]);

    const dateStr = toDateStr(selectedDate);
    const subtitleAgenda = `${weekdayLabel(selectedDate)}, ${pad2(
        selectedDate.getDate(),
    )}/${pad2(selectedDate.getMonth() + 1)}`;

    // helper for day range
    function startEndOfDay(d: Date) {
        const s = new Date(d);
        s.setHours(0, 0, 0, 0);
        const e = new Date(s);
        e.setDate(e.getDate() + 1);
        return { s, e };
    }
    const { s: dayStart, e: dayEnd } = React.useMemo(
        () => startEndOfDay(selectedDate),
        [selectedDate],
    );
    const [reloadKey, setReloadKey] = React.useState(0);
    const [lastEditedId, setLastEditedId] = React.useState<number | null>(null);
    const [highlightId, setHighlightId] = React.useState<number | null>(null);
    // Novo: highlight persistente enquanto em modo edição (#37)
    const [editingHighlightId, setEditingHighlightId] = React.useState<
        number | null
    >(null);
    // Ref para container scroll dos mini cards (para cálculo de visibilidade)
    const listRef = React.useRef<HTMLDivElement | null>(null);
    const { items: dayAppointments, loading: dayLoading } =
        useAppointmentsRange(dayStart, dayEnd, undefined, reloadKey);

    // Filtro de status (todos / ativos / cancelados)
    type DayFilter = 'todos' | 'ativos' | 'cancelados';
    const [dayFilter, setDayFilter] = React.useState<DayFilter>('todos');

    const filteredAppointments = React.useMemo(() => {
        if (dayFilter === 'todos') return dayAppointments;
        if (dayFilter === 'ativos')
            return dayAppointments.filter(a => a.status === 'scheduled');
        if (dayFilter === 'cancelados')
            return dayAppointments.filter(a => a.status === 'canceled');
        return dayAppointments;
    }, [dayAppointments, dayFilter]);

    // After reload, if we have a lastEditedId (criação/atualização), highlight temporário e scroll
    React.useEffect(() => {
        if (!dayLoading && lastEditedId) {
            const target = dayAppointments.find(a => a.id === lastEditedId);
            if (target) {
                setHighlightId(lastEditedId);
                // Scroll after next paint
                requestAnimationFrame(() => {
                    const el = document.getElementById(
                        `appt-card-${lastEditedId}`,
                    );
                    if (el) {
                        try {
                            const container = listRef.current;
                            let doScroll = true;
                            if (container) {
                                const cRect = container.getBoundingClientRect();
                                const eRect = el.getBoundingClientRect();
                                const visibleTop = Math.max(
                                    eRect.top,
                                    cRect.top,
                                );
                                const visibleBottom = Math.min(
                                    eRect.bottom,
                                    cRect.bottom,
                                );
                                const visibleHeight = Math.max(
                                    0,
                                    visibleBottom - visibleTop,
                                );
                                const ratio = visibleHeight / eRect.height;
                                if (ratio >= 0.6) doScroll = false; // já visível o suficiente
                            }
                            if (doScroll) {
                                el.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'center',
                                });
                            }
                        } catch {
                            /* noop */
                        }
                    }
                    // também rola o cartão do cliente para reforçar contexto
                    try {
                        window.dispatchEvent(
                            new CustomEvent('scrollToClientCard', {
                                detail: { clientId: client.id },
                            }),
                        );
                    } catch {
                        /* noop */
                    }
                });
                const t = setTimeout(() => setHighlightId(null), 2500);
                return () => clearTimeout(t);
            }
        }
    }, [dayLoading, dayAppointments, lastEditedId, client.id]);

    // Quando entra em modo edição, focar e aplicar highlight persistente (com retries para caso o card seja o último e ainda não renderizado).
    React.useEffect(() => {
        if (!open) return;
        if (currentEdit && currentEdit.id) {
            setEditingHighlightId(currentEdit.id);
            let attempts = 0;
            const MAX_ATTEMPTS = 10;
            const DELAY = 70; // ms
            const targetId = currentEdit.id;
            function tryScroll() {
                const el = document.getElementById(`appt-card-${targetId}`);
                if (el) {
                    try {
                        const container = listRef.current;
                        let doScroll = true;
                        if (container) {
                            const cRect = container.getBoundingClientRect();
                            const eRect = el.getBoundingClientRect();
                            const visibleTop = Math.max(eRect.top, cRect.top);
                            const visibleBottom = Math.min(
                                eRect.bottom,
                                cRect.bottom,
                            );
                            const visibleHeight = Math.max(
                                0,
                                visibleBottom - visibleTop,
                            );
                            const ratio = visibleHeight / eRect.height;
                            if (ratio >= 0.6) doScroll = false; // suficiente visível
                        }
                        if (doScroll) {
                            el.scrollIntoView({
                                behavior: 'smooth',
                                block: 'center',
                            });
                        }
                    } catch {
                        /* noop */
                    }
                } else if (attempts < MAX_ATTEMPTS) {
                    attempts += 1;
                    setTimeout(tryScroll, DELAY);
                }
            }
            // tenta após paint; se a lista ainda estiver carregando, o retry cobre
            requestAnimationFrame(tryScroll);
        } else {
            setEditingHighlightId(null);
        }
    }, [currentEdit, open, filteredAppointments.length]);

    const limitReached =
        !isEdit &&
        (client.next_appointment_status === 'scheduled' ? 1 : 0) +
            futureAppointments.length >=
            maxFutureAppointments;
    // nearLimit reservado para futura UI (mensagem de sugestão de empurrar data)
    // const nearLimit =
    //     !isEdit && futureAppointments.length === maxFutureAppointments - 1;

    async function handleSave() {
        if (saving) {
            console.debug(
                '[QuickSchedule] Ignorando clique extra enquanto saving=true',
            );
            return; // evita duplo clique / corrida
        }
        if (limitReached) {
            try {
                window.dispatchEvent(
                    new CustomEvent('systemMessage', {
                        detail: {
                            text: `Limite de ${maxFutureAppointments} compromissos futuros — não é possível criar novo agora`,
                            type: 'warning',
                        },
                    }),
                );
            } catch {
                /* noop: falha em disparar mensagem de limite */
            }
            return;
        }
        setError(null);
        // Validação básica horários
        const startM = toMinutes(startHM);
        const endM = toMinutes(endHM);
        if (isNaN(startM) || isNaN(endM)) {
            setError('Horário inválido');
            return;
        }
        if (endM - startM < MIN_DURATION_MIN) {
            setError(`Duração mínima de ${MIN_DURATION_MIN} min`);
            return;
        }
        if (endM <= startM) {
            setError('Hora final deve ser após a inicial');
            return;
        }
        // limpa mensagem local (agora global)
        setSaving(true);
        const t0 = performance.now();
        // AbortController com timeout defensivo para evitar spinner infinito em rede lenta / servidor travado
        const controller = new AbortController();
        const ABORT_MS = 15000; // 15s
        const abortTimer = setTimeout(() => {
            try {
                controller.abort();
                console.debug('[QuickSchedule] abort por timeout', ABORT_MS);
            } catch {
                /* noop */
            }
        }, ABORT_MS);
        try {
            console.debug('[QuickSchedule] handleSave start', {
                isEdit,
                clientId: client.id,
                startHM,
                endHM,
                dateStr,
            });
            const token = localStorage.getItem('accessToken');
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const startISO = new Date(`${dateStr}T${startHM}:00`).toISOString();
            const endISO = new Date(`${dateStr}T${endHM}:00`).toISOString();
            console.debug('[QuickSchedule] computed ISO', { startISO, endISO });

            const url = isEdit
                ? `${API_BASE}/agenda/appointments/${currentEdit!.id}/`
                : `${API_BASE}/agenda/appointments/`;
            const method = isEdit ? 'PATCH' : 'POST';
            if (setDefaultVisitType) {
                localStorage.setItem('defaultVisitType', visitType);
            }
            const body = isEdit
                ? JSON.stringify({ start_at: startISO, end_at: endISO, notes })
                : JSON.stringify({
                      client: client.id,
                      title: 'Consulta',
                      visit_type: visitType,
                      start_at: startISO,
                      end_at: endISO,
                      notes,
                  });
            console.debug('[QuickSchedule] fetch', { url, method, body });
            const resp = await fetch(url, {
                method,
                headers,
                body,
                signal: controller.signal,
            });
            console.debug('[QuickSchedule] response status', resp.status);
            if (!resp.ok) {
                const text = await resp.text();
                console.debug('[QuickSchedule] response error text', text);
                throw new Error(text || 'Erro na solicitação');
            }
            const wasEdit = isEdit;
            let updatedId: number | null = null;
            if (wasEdit && currentEdit) {
                updatedId = currentEdit.id;
            } else {
                // Need id from creation response
                try {
                    const created = await resp.json();
                    if (created && typeof created.id === 'number') {
                        updatedId = created.id;
                        console.debug(
                            '[QuickSchedule] parsed created id',
                            updatedId,
                        );
                    }
                } catch {
                    /* ignore parse issues */
                }
            }
            try {
                window.dispatchEvent(
                    new CustomEvent('systemMessage', {
                        detail: {
                            text: wasEdit
                                ? 'Compromisso atualizado'
                                : 'Compromisso criado',
                            type: 'success',
                        },
                    }),
                );
                // Dispara eventos globais para atualização imediata de outros componentes
                window.dispatchEvent(new Event('updateClients'));
                window.dispatchEvent(
                    new CustomEvent('appointments:changed', { detail: {} }),
                );
                console.debug(
                    '[QuickSchedule] eventos disparados (systemMessage, updateClients, appointments:changed)',
                );
            } catch {
                /* noop */
            }
            setReloadKey(k => k + 1); // refresh list
            console.debug('[QuickSchedule] reload list triggered', {
                updatedId,
            });
            if (updatedId) setLastEditedId(updatedId);
            if (afterPersist)
                afterPersist(updatedId, wasEdit ? 'updated' : 'created');
            // Nota: auto-close opcional (apenas criação) para fluxo rápido.
            // Aguardos de 3s foram eliminados — fechamento é quase imediato para reduzir fricção.
            if (!wasEdit && AUTO_CLOSE_QUICK_SCHEDULE_ON_CREATE) {
                // Marca tempo para auto-close UX
                console.debug('[QuickSchedule] scheduling auto-close');
                // Desbloqueia scroll já aqui (caso o lock ainda esteja ativo) para reduzir sensação de travamento
                try {
                    window.dispatchEvent(new Event('ensureScrollUnlocked'));
                } catch {
                    /* noop */
                }
                setTimeout(() => {
                    try {
                        window.dispatchEvent(new Event('clients:forceRefresh'));
                    } catch {
                        /* noop */
                    }
                    handleImmediateClose();
                }, 160); // reduzido de 250 -> 160ms
            }
        } catch (e) {
            const msg =
                typeof e === 'object' && e && 'message' in e
                    ? String((e as Error).message)
                    : 'Erro ao salvar';
            if (msg === 'The user aborted a request.' || /abort/i.test(msg)) {
                setError('Tempo excedido. Tente novamente.');
            } else {
                setError(msg);
            }
            console.debug('[QuickSchedule] erro ao salvar', msg);
        } finally {
            clearTimeout(abortTimer);
            setSaving(false);
            const t1 = performance.now();
            console.debug(
                '[QuickSchedule] handleSave end (latency ms)',
                (t1 - t0).toFixed(1),
            );
            // Fallback extra para desbloquear scroll mesmo se MUI não disparar (race)
            try {
                window.dispatchEvent(new Event('ensureScrollUnlocked'));
            } catch {
                /* noop */
            }
        }
    }

    // Safety: se por algum bug "saving" ficar preso > 20s, desfaz estado e exibe mensagem
    React.useEffect(() => {
        if (!saving) return;
        const safety = setTimeout(() => {
            setSaving(false);
            setError(
                prev =>
                    prev ||
                    'Operação demorou demais. Verifique conexão e tente novamente.',
            );
            try {
                window.dispatchEvent(new Event('ensureScrollUnlocked'));
            } catch {
                /* noop */
            }
        }, 20000);
        return () => clearTimeout(safety);
    }, [saving]);

    // Wrapper para fechar garantindo desbloqueio imediato (mitiga atraso percebido)
    const handleImmediateClose = React.useCallback(() => {
        try {
            onClose();
        } finally {
            try {
                window.dispatchEvent(new Event('ensureScrollUnlocked'));
                // Instrumentação
                console.debug(
                    '[QuickSchedule] close -> ensureScrollUnlocked dispatched',
                );
            } catch {
                /* noop */
            }
        }
    }, [onClose]);

    return (
        <AppModal
            open={open}
            onClose={handleImmediateClose}
            closeOnEnter={false}
            fullScreen={expanded}
        >
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: expanded ? 16 : 12,
                    position: 'relative',
                    maxWidth: expanded ? 1280 : undefined,
                    margin: '0 auto',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 12,
                        flexWrap: 'wrap',
                    }}
                >
                    <h2
                        style={{
                            margin: '0 0 4px 0',
                            fontSize: expanded ? 28 : 20,
                            fontWeight: 800,
                            color: '#111827',
                        }}
                    >
                        {isEdit ? 'Editar compromisso' : 'Agendar compromisso'}
                    </h2>
                    <button
                        type='button'
                        onClick={() => setExpanded(v => !v)}
                        style={{
                            border: '1px solid #d1d5db',
                            background: expanded ? '#1e3a8a' : '#f3f4f6',
                            color: expanded ? '#fff' : '#111827',
                            padding: '6px 12px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 600,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                            alignSelf: 'flex-start',
                        }}
                        title={
                            expanded
                                ? 'Reduzir tamanho'
                                : 'Expandir para tela cheia'
                        }
                    >
                        {expanded ? 'Reduzir' : 'Expandir'}
                    </button>
                </div>
                <div style={{ color: '#374151' }}>
                    <div style={{ marginBottom: 4 }}>
                        <strong>Nome:</strong> {client.first_name}{' '}
                        {client.last_name}
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}
                    >
                        <span>
                            <strong>Agenda:</strong> {subtitleAgenda}
                        </span>
                        <button
                            type='button'
                            onClick={() => setShowPicker(v => !v)}
                            title='Selecionar dia'
                            style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                padding: 4,
                            }}
                        >
                            <FaCalendarAlt color='#2563eb' />
                        </button>
                    </div>
                </div>
                <div
                    style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                    }}
                >
                    <TimePicker10
                        label='Início'
                        value={startHM}
                        onChange={val => {
                            setStartHM(val);
                            // enforce min 1h
                            const sMin = toMinutes(val);
                            const eMin = toMinutes(endHM);
                            if (eMin < sMin + MIN_DURATION_MIN) {
                                let newEnd = sMin + MIN_DURATION_MIN;
                                // clamp to 21:00 (21*60)
                                const max = 21 * 60; // inclusive hour boundary but we don't allow exceed
                                if (newEnd > max) newEnd = max;
                                setEndHM(fromMinutes(newEnd));
                            }
                        }}
                        minHour={6}
                        maxHour={21}
                    />
                    <TimePicker10
                        label='Fim'
                        value={endHM}
                        onChange={val => {
                            const sMin = toMinutes(startHM);
                            let eMin = toMinutes(val);
                            if (eMin < sMin + MIN_DURATION_MIN) {
                                eMin = Math.min(
                                    sMin + MIN_DURATION_MIN,
                                    21 * 60,
                                );
                            }
                            setEndHM(fromMinutes(eMin));
                        }}
                        minHour={6}
                        maxHour={21}
                    />
                    <label style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>
                            Tipo
                        </span>
                        <select
                            value={visitType}
                            onChange={e =>
                                setVisitType(
                                    e.target.value as
                                        | 'avaliacao'
                                        | 'retorno'
                                        | 'procedimento'
                                        | 'outro'
                                        | 'consulta',
                                )
                            }
                            style={{ padding: '6px 8px' }}
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
                {/* Observações */}
                <label style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>
                        Observações
                    </span>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={3}
                        style={{ padding: '8px', resize: 'vertical' }}
                        placeholder='Anotações rápidas...'
                    />
                </label>
                {/* Day agenda list (header sticky) */}
                <div
                    style={{
                        marginTop: 4,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        maxHeight: expanded ? 'calc(100vh - 360px)' : 260,
                        // Removido overflow hidden para não interferir em gesto vertical no iOS;
                        // a rolagem é controlada pelo filho interno (scroll container)
                        overflow: 'visible',
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        background: '#fdfdfd',
                    }}
                >
                    <div
                        style={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            color: '#374151',
                            padding: expanded ? '10px 14px' : '6px 8px',
                            background: 'linear-gradient(#ffffff,#f8fafc)',
                            borderBottom: '1px solid #e5e7eb',
                        }}
                    >
                        <strong style={{ fontSize: expanded ? 18 : 14 }}>
                            Compromissos do dia
                        </strong>
                        <div
                            style={{
                                display: 'flex',
                                gap: 8,
                                alignItems: 'center',
                            }}
                        >
                            <select
                                value={dayFilter}
                                onChange={e =>
                                    setDayFilter(e.target.value as DayFilter)
                                }
                                style={{
                                    padding: expanded ? '8px 12px' : '6px 10px',
                                    fontSize: expanded ? 15 : 13,
                                    fontWeight: 600,
                                    border: '1px solid #d1d5db',
                                    borderRadius: 6,
                                    background: '#f1f5f9',
                                    cursor: 'pointer',
                                }}
                                title='Filtrar por status'
                            >
                                <option value='todos'>
                                    Todos ({dayAppointments.length})
                                </option>
                                <option value='ativos'>
                                    Ativos (
                                    {
                                        dayAppointments.filter(
                                            a => a.status === 'scheduled',
                                        ).length
                                    }
                                    )
                                </option>
                                <option value='cancelados'>
                                    Cancelados (
                                    {
                                        dayAppointments.filter(
                                            a => a.status === 'canceled',
                                        ).length
                                    }
                                    )
                                </option>
                            </select>
                            {dayLoading && (
                                <span
                                    style={{
                                        fontSize: expanded ? 13 : 11,
                                        color: '#6b7280',
                                    }}
                                >
                                    carregando…
                                </span>
                            )}
                        </div>
                    </div>
                    <div
                        style={{
                            overflowY: 'auto',
                            overflowX: 'hidden', // evita scroll horizontal acidental
                            padding: expanded
                                ? '10px 14px 16px'
                                : '4px 8px 8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            flex: 1,
                            WebkitOverflowScrolling: 'touch', // iOS momentum
                            overscrollBehavior: 'contain', // evita bounce propagando
                            touchAction: 'pan-y', // garante scroll vertical responsivo
                            maxHeight: '100%',
                            // Evita caso raro de congelamento quando container pai tem overflow hidden
                            // forcing também minHeight para que iOS reconheça área scrollable
                            minHeight: 120,
                            width: '100%',
                            boxSizing: 'border-box',
                        }}
                        ref={listRef}
                    >
                        {filteredAppointments
                            .slice()
                            .sort((a, b) =>
                                a.start_at.localeCompare(b.start_at),
                            )
                            .map(appt => (
                                <AppointmentCard
                                    key={appt.id}
                                    appt={appt}
                                    highlight={highlightId === appt.id}
                                    editingActive={
                                        editingHighlightId === appt.id
                                    }
                                    pulse={
                                        editingHighlightId === appt.id &&
                                        currentEdit?.id === appt.id
                                    }
                                    onUseTime={a => {
                                        const sd = new Date(a.start_at);
                                        const ed = new Date(a.end_at);
                                        setSelectedDate(sd);
                                        setStartHM(
                                            `${pad2(sd.getHours())}:${pad2(
                                                sd.getMinutes(),
                                            )}`,
                                        );
                                        setEndHM(
                                            `${pad2(ed.getHours())}:${pad2(
                                                ed.getMinutes(),
                                            )}`,
                                        );
                                        // stay in create mode
                                        setCurrentEdit(null);
                                    }}
                                    onEdit={a => {
                                        setCurrentEdit(a);
                                    }}
                                    onCancel={async a => {
                                        try {
                                            const token =
                                                localStorage.getItem(
                                                    'accessToken',
                                                );
                                            const headers: Record<
                                                string,
                                                string
                                            > = {
                                                'Content-Type':
                                                    'application/json',
                                            };
                                            if (token)
                                                headers[
                                                    'Authorization'
                                                ] = `Bearer ${token}`;
                                            const resp = await fetch(
                                                `${API_BASE}/agenda/appointments/${a.id}/cancel/`,
                                                { method: 'POST', headers },
                                            );
                                            if (!resp.ok) {
                                                const text = await resp.text();
                                                throw new Error(
                                                    text || 'Erro ao cancelar',
                                                );
                                            }
                                            setReloadKey(k => k + 1);
                                            // (Removido toast de sucesso de cancelamento para evitar sobreposição visual)
                                            // Atualiza clientes e depois rola cartão do cliente
                                            try {
                                                window.dispatchEvent(
                                                    new Event('updateClients'),
                                                );
                                                // Task #36: garante que outras visões (cards, agenda diária) invalidem cache/listas
                                                window.dispatchEvent(
                                                    new CustomEvent(
                                                        'appointments:changed',
                                                        { detail: {} },
                                                    ),
                                                );
                                            } catch {
                                                /* noop */
                                            }
                                            setTimeout(() => {
                                                try {
                                                    window.dispatchEvent(
                                                        new CustomEvent(
                                                            'scrollToClientCard',
                                                            {
                                                                detail: {
                                                                    clientId:
                                                                        client.id,
                                                                },
                                                            },
                                                        ),
                                                    );
                                                } catch {
                                                    /* noop */
                                                }
                                            }, 120);
                                            if (currentEdit?.id === a.id) {
                                                setCurrentEdit(null);
                                            }
                                            if (lastEditedId === a.id) {
                                                setLastEditedId(null);
                                                setHighlightId(null);
                                            }
                                            // Novo comportamento: fechar modal imediatamente após cancelamento bem-sucedido
                                            try {
                                                handleImmediateClose();
                                            } catch {
                                                /* noop */
                                            }
                                        } catch (err) {
                                            const msg =
                                                typeof err === 'object' &&
                                                err &&
                                                'message' in err
                                                    ? String(
                                                          (err as Error)
                                                              .message,
                                                      )
                                                    : 'Erro ao cancelar';
                                            setError(msg);
                                        }
                                    }}
                                />
                            ))}
                        {!dayLoading && filteredAppointments.length === 0 && (
                            <div style={{ color: '#6b7280', fontSize: 13 }}>
                                Nenhum compromisso neste filtro.
                            </div>
                        )}
                    </div>
                </div>
                {error && (
                    <div style={{ color: '#b91c1c', fontSize: 14 }}>
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
                        onClick={handleImmediateClose}
                        style={{ padding: '8px 12px', background: '#e5e7eb' }}
                        disabled={saving}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        style={{
                            padding: '8px 12px',
                            background: '#059669',
                            color: '#fff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                        }}
                        disabled={saving}
                    >
                        {saving && (
                            <span
                                style={{
                                    width: 14,
                                    height: 14,
                                    borderRadius: '50%',
                                    border: '2px solid rgba(255,255,255,0.6)',
                                    borderTopColor: 'rgba(255,255,255,1)',
                                    animation: 'qsSpin 0.8s linear infinite',
                                }}
                            />
                        )}
                        {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar'}
                    </button>
                </div>
                {/* Spinner keyframes inline (injetado uma vez) */}
                <style>
                    {`@keyframes qsSpin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}
                </style>
                <FloatingDatePicker
                    open={showPicker}
                    onClose={() => setShowPicker(false)}
                    selectedDate={selectedDate}
                    onChange={d => {
                        setSelectedDate(d);
                        setShowPicker(false); // close after selecting the day
                    }}
                />
            </div>
        </AppModal>
    );
}
