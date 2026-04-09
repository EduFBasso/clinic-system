import React from 'react';
import { dispatchers } from '../events/dispatchers';
import AppModal from './Modal';
import TimePicker10 from './TimePicker10';
import FloatingDatePicker from './FloatingDatePicker';
import QuickScheduleHeader from './quickschedule/QuickScheduleHeader';
import DateControlsHeader from './shared/DateControlsHeader';
import QuickScheduleDayList, {
    type DayFilter,
} from './quickschedule/QuickScheduleDayList';
// PendingActionsModal é global (Home)
import AppointmentDetailsModal from './AppointmentDetailsModal';
import type { ClientBasic } from '../types/ClientBasic';
import type { Appointment } from '../hooks/useAppointments';
import { useAppointmentsRange } from '../hooks/useAppointments';
import { getNow } from '../utils/now';
import {
    getSlotInterval,
    getWorkTimes,
    getDefaultDuration,
} from '../utils/agendaSettings';
import { API_BASE } from '../config/api';
import { track } from '../utils/telemetry';
import { usePendingGuard } from '../hooks/usePendingGuard';
import { focusClientCard } from '../utils/focusClientCard';
import { useQuickScheduleSave } from '../hooks/useQuickScheduleSave';
import { pad2, toMinutes, fromMinutes, weekdayLabel } from '../utils/hmTime';

type VisitType = Appointment['visit_type'];
type ClientMaybeNext = ClientBasic & { next_appointment_id?: number };

interface QuickScheduleModalProps {
    open: boolean;
    onClose: () => void;
    client: ClientBasic;
    editAppointment?: Appointment | null;
    afterPersist?: (id?: number, action?: 'created' | 'updated') => void;
    futureAppointments?: Array<unknown>;
    maxFutureAppointments?: number;
}

export default function QuickScheduleModal({
    open,
    onClose,
    client,
    editAppointment,
    afterPersist,
}: QuickScheduleModalProps) {
    const isEdit = !!editAppointment;
    const [selectedDate, setSelectedDate] = React.useState<Date>(() => {
        if (isEdit && editAppointment)
            return new Date(editAppointment.start_at);
        const base = getNow();
        base.setMinutes(base.getMinutes() + 60);
        return base;
    });
    const [startHM, setStartHM] = React.useState<string>(() => {
        if (isEdit && editAppointment) {
            const d = new Date(editAppointment.start_at);
            return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
        }
        const d = new Date(selectedDate);
        return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    });
    const [endHM, setEndHM] = React.useState<string>(() => {
        if (isEdit && editAppointment) {
            const d = new Date(editAppointment.end_at);
            return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
        }
        const mins = toMinutes(startHM) + getDefaultDuration();
        return fromMinutes(mins);
    });
    const [visitType, setVisitType] = React.useState<VisitType>(
        (isEdit && editAppointment
            ? editAppointment.visit_type
            : 'consulta') as VisitType,
    );
    // removed: 'definir como padrão' toggle; managed in Agenda settings
    const [notes, setNotes] = React.useState<string>(
        (isEdit && editAppointment && editAppointment.notes) || '',
    );
    const [reloadKey, setReloadKey] = React.useState(0);
    const [currentEdit, setCurrentEdit] = React.useState<Appointment | null>(
        editAppointment || null,
    );
    const [lastEditedId, setLastEditedId] = React.useState<number | null>(null);
    const [highlightId, setHighlightId] = React.useState<number | null>(null);
    const [editingHighlightId, setEditingHighlightId] = React.useState<
        number | null
    >(currentEdit?.id ?? null);
    const [showPicker, setShowPicker] = React.useState(false);
    const listRef = React.useRef<HTMLDivElement | null>(null);
    const workTimes = getWorkTimes();
    // Removed: flexible minute mode (minuto livre) — simplificação: sempre respeita intervalo configurado

    // Day range for list
    const dayStart = React.useMemo(() => {
        const d = new Date(selectedDate);
        d.setHours(0, 0, 0, 0);
        return d;
    }, [selectedDate]);
    const dayEnd = React.useMemo(() => {
        const d = new Date(dayStart);
        d.setDate(d.getDate() + 1);
        return d;
    }, [dayStart]);

    // Important: QuickSchedule shows the day grid like Daily/Weekly, irrespective of client.
    // Do NOT filter by client here; the day list must show all appointments to avoid double-booking.
    const { items: dayAppointments, loading: dayLoading } =
        useAppointmentsRange(dayStart, dayEnd, undefined, reloadKey);

    const [dayFilter, setDayFilter] = React.useState<DayFilter>('todos');
    const [cancelError, setCancelError] = React.useState<string | null>(null);
    function setError(msg: string) {
        setCancelError(msg);
    }

    // Details modal for viewing completed (done) appointments
    const [detailsOpen, setDetailsOpen] = React.useState(false);
    const [detailsAppt, setDetailsAppt] = React.useState<Appointment | null>(
        null,
    );

    // Title helpers
    // removed: separate subtitle; DateControlsHeader label covers the date context
    const sectionDateTitle = React.useMemo(() => {
        const d = selectedDate;
        const dd = `${pad2(d.getDate())}/${pad2(
            d.getMonth() + 1,
        )}/${d.getFullYear()}`;
        return `${weekdayLabel(d)} — ${dd}`;
    }, [selectedDate]);

    // Past-date guard — disable Criar when selected date is before today
    const isSelectedPast = React.useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sel = new Date(selectedDate);
        sel.setHours(0, 0, 0, 0);
        return sel.getTime() < today.getTime();
    }, [selectedDate]);

    // Pending guard (block create when client has pending)
    const { found: pendingFound, refresh: refreshPendingGuard } =
        usePendingGuard({
            open,
            isEdit,
            clientId: client.id,
        });
    const isPending = !!pendingFound;
    // PendingActions é global — sem estado local

    // Removido alinhamento local — Home coordena
    React.useEffect(() => {
        if (!dayLoading && lastEditedId) {
            const exists = dayAppointments.some(a => a.id === lastEditedId);
            if (exists) {
                setHighlightId(lastEditedId);
                requestAnimationFrame(() => {
                    try {
                        const el = document.getElementById(
                            `appt-card-${lastEditedId}`,
                        );
                        if (el && el.scrollIntoView)
                            el.scrollIntoView({ block: 'center' });
                    } catch {
                        /* noop */
                    }
                });
                const t = window.setTimeout(() => setHighlightId(null), 2500);
                return () => window.clearTimeout(t);
            }
        }
        return;
    }, [dayLoading, lastEditedId, dayAppointments]);

    // Recarrega a lista do dia quando houver mudanças externas de compromissos
    React.useEffect(() => {
        if (!open) return;
        const onChanged = () => setReloadKey(k => k + 1);
        window.addEventListener('appointments:changed', onChanged);
        return () =>
            window.removeEventListener('appointments:changed', onChanged);
    }, [open]);

    // buildDateStr no longer needed; we construct dates via Date API

    const handleImmediateClose = React.useCallback(() => {
        try {
            window.dispatchEvent(new Event('ensureScrollUnlocked'));
        } catch {
            /* noop */
        }
        try {
            refreshPendingGuard();
        } catch {
            /* noop */
        }
        onClose();
    }, [onClose, refreshPendingGuard]);

    const { saving, error, handleSave } = useQuickScheduleSave({
        selectedDate,
        startHM,
        endHM,
        visitType,
        notes,
        clientId: client.id,
        currentEdit,
        afterPersist,
        onSuccess: updatedId => {
            setReloadKey(k => k + 1);
            if (updatedId) setLastEditedId(updatedId);
        },
        onImmediateClose: handleImmediateClose,
    });

    return (
        <>
            <AppModal
                open={open}
                onClose={handleImmediateClose}
                closeOnEnter={false}
                showCloseButton={false}
                fullScreen
                disableTopSafePadding={true}
                maxHeightVh={96}
                actionsBarStyle={{
                    background: 'transparent',
                    borderBottom: 'none',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16,
                        position: 'relative',
                        width: '100%',
                    }}
                >
                    {/* Title + client info remain; date controls standardized below */}
                    <QuickScheduleHeader
                        clientFullName={`${client.first_name} ${client.last_name}`}
                        isEditing={!!currentEdit}
                        onClose={handleImmediateClose}
                    />

                    <DateControlsHeader
                        currentDate={selectedDate}
                        label={sectionDateTitle}
                        prevDisabled={
                            isSelectedPast ||
                            (() => {
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const sel = new Date(selectedDate);
                                sel.setHours(0, 0, 0, 0);
                                return sel.getTime() <= today.getTime();
                            })()
                        }
                        onPrev={() => {
                            const prev = new Date(
                                selectedDate.getFullYear(),
                                selectedDate.getMonth(),
                                selectedDate.getDate() - 1,
                            );
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            if (prev.getTime() >= today.getTime())
                                setSelectedDate(prev);
                        }}
                        onNext={() =>
                            setSelectedDate(
                                d =>
                                    new Date(
                                        d.getFullYear(),
                                        d.getMonth(),
                                        d.getDate() + 1,
                                    ),
                            )
                        }
                        onToday={() => setSelectedDate(new Date())}
                        onOpenPicker={() => setShowPicker(true)}
                    />

                    {/** Compact status switch moved next to the minicards (inside QuickScheduleDayList). Removed big toggle here to save space. **/}

                    {!isEdit && isPending && (
                        <div
                            style={{
                                background: '#f3f4f6',
                                border: '1px solid #d1d5db',
                                color: '#374151',
                                padding: '8px 10px',
                                borderRadius: 8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                            }}
                        >
                            <div>
                                <strong>Atenção:</strong> há um compromisso
                                pendente para este cliente. Finalize-o antes de
                                criar um novo.
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    onClick={async () => {
                                        try {
                                            const id = (pendingFound?.id ||
                                                (client as ClientMaybeNext)
                                                    .next_appointment_id) as
                                                | number
                                                | undefined;
                                            if (!id) {
                                                focusClientCard(client.id);
                                                return;
                                            }
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
                                                headers['Authorization'] =
                                                    `Bearer ${token}`;
                                            const resp = await fetch(
                                                `${API_BASE}/agenda/appointments/${id}/`,
                                                { headers },
                                            );
                                            if (!resp.ok)
                                                throw new Error(
                                                    'Falha ao carregar compromisso pendente',
                                                );
                                            const appt =
                                                (await resp.json()) as Appointment;
                                            try {
                                                const a = appt as Appointment;
                                                const anyAppt =
                                                    a as unknown as Record<
                                                        string,
                                                        unknown
                                                    >;
                                                const clientName = (():
                                                    | string
                                                    | undefined => {
                                                    if (
                                                        typeof anyAppt.client_name ===
                                                        'string'
                                                    )
                                                        return anyAppt.client_name as string;
                                                    const c =
                                                        anyAppt.client as unknown;
                                                    if (
                                                        c &&
                                                        typeof c === 'object' &&
                                                        'name' in
                                                            (c as Record<
                                                                string,
                                                                unknown
                                                            >)
                                                    ) {
                                                        const n = (
                                                            c as {
                                                                name?: unknown;
                                                            }
                                                        ).name;
                                                        if (
                                                            typeof n ===
                                                            'string'
                                                        )
                                                            return n;
                                                    }
                                                    return undefined;
                                                })();
                                                const clientField =
                                                    ((): unknown => {
                                                        const c =
                                                            anyAppt.client as unknown;
                                                        if (
                                                            typeof c ===
                                                                'number' ||
                                                            typeof c ===
                                                                'object'
                                                        )
                                                            return c;
                                                        return undefined;
                                                    })();
                                                const payload = {
                                                    id: a.id,
                                                    start_at: a.start_at,
                                                    end_at: a.end_at,
                                                    status: a.status,
                                                    notes: a.notes,
                                                    client_name: clientName,
                                                    client: clientField,
                                                    title: a.title,
                                                } as unknown as import('../components/shared/AppointmentCard').SharedAppointmentLike;
                                                window.dispatchEvent(
                                                    new CustomEvent(
                                                        'pendingActions:open',
                                                        {
                                                            detail: {
                                                                appt: payload,
                                                            },
                                                        },
                                                    ),
                                                );
                                            } catch {
                                                /* noop */
                                            }
                                        } catch (e) {
                                            const msg =
                                                e &&
                                                typeof e === 'object' &&
                                                'message' in e
                                                    ? String(
                                                          (e as Error).message,
                                                      )
                                                    : 'Erro ao abrir pendência';
                                            try {
                                                window.dispatchEvent(
                                                    new CustomEvent(
                                                        'systemMessage',
                                                        {
                                                            detail: {
                                                                text: msg,
                                                                type: 'warning',
                                                            },
                                                        },
                                                    ),
                                                );
                                            } catch {
                                                /* noop */
                                            }
                                        }
                                    }}
                                    style={{
                                        padding: '6px 10px',
                                        background: '#e5e7eb',
                                    }}
                                >
                                    Resolver agora
                                </button>
                                <button
                                    onClick={handleImmediateClose}
                                    style={{
                                        padding: '6px 10px',
                                        background: '#e5e7eb',
                                    }}
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* PendingActionsModal é global (Home) */}

                    <div
                        style={{
                            display: 'flex',
                            gap: 12,
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            marginTop: 8,
                        }}
                    >
                        <TimePicker10
                            label='Início'
                            value={startHM}
                            onChange={val => {
                                setStartHM(val);
                                const sMin = toMinutes(val);
                                let newEnd = sMin + getDefaultDuration();
                                const max =
                                    workTimes.endHour * 60 + workTimes.endMin;
                                if (newEnd > max) newEnd = max;
                                setEndHM(fromMinutes(newEnd));
                            }}
                            minHour={workTimes.startHour}
                            maxHour={workTimes.endHour}
                            minHM={`${pad2(workTimes.startHour)}:${pad2(
                                workTimes.startMin,
                            )}`}
                            maxHM={`${pad2(workTimes.endHour)}:${pad2(
                                workTimes.endMin,
                            )}`}
                            stepMinutes={
                                getSlotInterval() as 1 | 5 | 10 | 15 | 20 | 30
                            }
                        />
                        <TimePicker10
                            label='Fim'
                            value={endHM}
                            onChange={val => setEndHM(val)}
                            minHour={workTimes.startHour}
                            maxHour={workTimes.endHour}
                            minHM={`${pad2(workTimes.startHour)}:${pad2(
                                workTimes.startMin,
                            )}`}
                            maxHM={`${pad2(workTimes.endHour)}:${pad2(
                                workTimes.endMin,
                            )}`}
                            stepMinutes={
                                getSlotInterval() as 1 | 5 | 10 | 15 | 20 | 30
                            }
                        />
                        {/* Removed: "Minuto livre" checkbox (flexible minute mode) */}
                        <label
                            style={{ display: 'flex', flexDirection: 'column' }}
                        >
                            <span style={{ fontSize: 12, color: '#6b7280' }}>
                                Tipo
                            </span>
                            <select
                                value={visitType}
                                onChange={e =>
                                    setVisitType(e.target.value as VisitType)
                                }
                                style={{ padding: '6px 8px' }}
                            >
                                <option value='consulta'>Consulta</option>
                                <option value='avaliacao'>Avaliação</option>
                                <option value='retorno'>Retorno</option>
                                <option value='procedimento'>
                                    Procedimento
                                </option>
                                <option value='outro'>Outro</option>
                            </select>
                        </label>
                        {/** Removed 'Definir como padrão' toggle (managed in settings) **/}
                    </div>

                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={3}
                        style={{
                            padding: '8px',
                            resize: 'vertical',
                            background: '#f8fafc',
                            border: '1px solid var(--color-border)',
                            borderRadius: 8,
                        }}
                        placeholder='Anotações rápidas...'
                    />

                    <div
                        style={{
                            display: 'flex',
                            gap: 8,
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            position: 'sticky',
                            top: 0,
                            zIndex: 5,
                            paddingTop: 6,
                            paddingBottom: 6,
                            background: 'var(--color-bg)',
                        }}
                    >
                        {/* Right actions: Cancel + Create/Save grouped together */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                            }}
                        >
                            <button
                                onClick={handleImmediateClose}
                                style={{
                                    padding: '8px 12px',
                                    background: '#e5e7eb',
                                }}
                                disabled={saving}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                style={{
                                    padding: '8px 12px',
                                    background:
                                        !isEdit && isSelectedPast
                                            ? '#9ca3af'
                                            : '#059669',
                                    color: '#fff',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    cursor:
                                        !isEdit && isSelectedPast
                                            ? 'not-allowed'
                                            : 'pointer',
                                }}
                                disabled={saving || (!isEdit && isSelectedPast)}
                                title={
                                    !isEdit && isSelectedPast
                                        ? 'Não é permitido agendar no passado'
                                        : undefined
                                }
                            >
                                {saving && (
                                    <span
                                        style={{
                                            width: 14,
                                            height: 14,
                                            borderRadius: '50%',
                                            border: '2px solid rgba(255,255,255,0.6)',
                                            borderTopColor:
                                                'rgba(255,255,255,1)',
                                            animation:
                                                'qsSpin 0.8s linear infinite',
                                        }}
                                    />
                                )}
                                {saving
                                    ? 'Salvando...'
                                    : isEdit
                                      ? 'Salvar'
                                      : 'Criar'}
                            </button>
                        </div>
                    </div>

                    <QuickScheduleDayList
                        appointments={dayAppointments}
                        loading={dayLoading}
                        dayFilter={dayFilter}
                        onChangeFilter={setDayFilter}
                        sectionDateTitle={sectionDateTitle}
                        highlightId={highlightId}
                        editingHighlightId={editingHighlightId}
                        currentEditId={currentEdit?.id ?? null}
                        listRef={listRef}
                        minimal={true}
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
                            setCurrentEdit(null);
                        }}
                        onEdit={a => {
                            setCurrentEdit(a);
                            setEditingHighlightId(a.id);
                        }}
                        onCancel={async a => {
                            try {
                                const { cancelAppointment } =
                                    await import('../services/appointments');
                                const res = await cancelAppointment(a.id);
                                if (!res.ok) {
                                    throw new Error(
                                        res.text || 'Erro ao cancelar',
                                    );
                                }
                                setReloadKey(k => k + 1);
                                try {
                                    track({
                                        type: 'appointment_cancel_succeeded',
                                        payload: { id: a.id },
                                    });
                                } catch {
                                    /* noop */
                                }
                                try {
                                    dispatchers.updateClients();
                                    dispatchers.appointmentsChanged();
                                } catch {
                                    /* noop */
                                }
                                setTimeout(
                                    () => focusClientCard(client.id),
                                    120,
                                );
                                if (currentEdit?.id === a.id)
                                    setCurrentEdit(null);
                                if (lastEditedId === a.id) {
                                    setLastEditedId(null);
                                    setHighlightId(null);
                                }
                                try {
                                    handleImmediateClose();
                                } catch {
                                    /* noop */
                                }
                            } catch (err) {
                                const msg =
                                    err &&
                                    typeof err === 'object' &&
                                    'message' in err
                                        ? String((err as Error).message)
                                        : 'Erro ao cancelar';
                                try {
                                    console.warn(
                                        '[QuickSchedule] cancel failed',
                                        { id: a.id, msg },
                                    );
                                } catch {
                                    /* noop */
                                }
                                setError(msg);
                                try {
                                    track({
                                        type: 'appointment_cancel_failed',
                                        payload: { id: a.id, error: msg },
                                    });
                                } catch {
                                    /* noop */
                                }
                            }
                        }}
                    />

                    {!isEdit && isSelectedPast && (
                        <div
                            style={{
                                color: '#b45309',
                                background: '#fffbeb',
                                border: '1px solid #fcd34d',
                                borderRadius: 6,
                                padding: '8px 12px',
                                fontSize: 13,
                                fontWeight: 500,
                            }}
                        >
                            Esta data já passou. Selecione hoje ou uma data
                            futura para criar um compromisso.
                        </div>
                    )}
                    {error && (
                        <div style={{ color: '#b91c1c', fontSize: 14 }}>
                            {error}
                        </div>
                    )}
                    <style>{`@keyframes qsSpin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
                    <FloatingDatePicker
                        open={showPicker}
                        onClose={() => setShowPicker(false)}
                        selectedDate={selectedDate}
                        onChange={d => {
                            setSelectedDate(d);
                            setShowPicker(false);
                        }}
                    />
                </div>
            </AppModal>
            {detailsOpen && detailsAppt && (
                <AppointmentDetailsModal
                    open={detailsOpen}
                    onClose={() => {
                        setDetailsOpen(false);
                        setDetailsAppt(null);
                    }}
                    appt={detailsAppt}
                />
            )}
        </>
    );
}
