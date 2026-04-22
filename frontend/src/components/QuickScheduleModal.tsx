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
import type {
    QuickScheduleInitialDraft,
    QuickScheduleReturnContext,
} from '../types/agendaFlow';
import { useAppointmentsRange } from '../hooks/useAppointments';
import { getNow } from '../utils/now';
import {
    getWorkTimesFromSnapshot,
} from '../utils/agendaSettings';
import { API_BASE } from '../config/api';
import { track } from '../utils/telemetry';
import { usePendingGuard } from '../hooks/usePendingGuard';
import { focusClientCard } from '../utils/focusClientCard';
import { openPendingActionsForAppointment } from '../utils/appointments/openPendingActions';
import { useQuickScheduleSave } from '../hooks/useQuickScheduleSave';
import { useAgendaSettings } from '../hooks/useAgendaSettings';
import { pad2, toMinutes, fromMinutes, weekdayLabel } from '../utils/hmTime';
import { useAgendaFinalizeAction } from '../hooks/useAgendaFinalizeAction';

type VisitType = Appointment['visit_type'];
type ClientMaybeNext = ClientBasic & { next_appointment_id?: number };

function getAppointmentClientFullName(
    appointment: Appointment | null | undefined,
): string | null {
    if (!appointment) return null;
    if (typeof appointment.client_name === 'string') {
        const value = appointment.client_name.trim();
        if (value) return value;
    }
    const clientValue = appointment.client as unknown;
    if (
        clientValue &&
        typeof clientValue === 'object' &&
        'name' in (clientValue as Record<string, unknown>)
    ) {
        const value = (clientValue as { name?: unknown }).name;
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return null;
}

interface QuickScheduleModalProps {
    open: boolean;
    onClose: () => void;
    client: ClientBasic;
    editAppointment?: Appointment | null;
    initialDraft?: QuickScheduleInitialDraft | null;
    afterPersist?: (id?: number, action?: 'created' | 'updated') => void;
    futureAppointments?: Array<unknown>;
    maxFutureAppointments?: number;
}

export default function QuickScheduleModal({
    open,
    onClose,
    client,
    editAppointment,
    initialDraft,
    afterPersist,
}: QuickScheduleModalProps) {
    const isInitialEdit = !!editAppointment;
    const draftDate = React.useMemo(() => {
        if (!initialDraft) return null;
        const parsed = new Date(initialDraft.selectedDateISO);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }, [initialDraft]);
    const agendaSettings = useAgendaSettings();
    const workTimes = React.useMemo(
        () => getWorkTimesFromSnapshot(agendaSettings),
        [agendaSettings],
    );
    const slotInterval = agendaSettings.slotInterval as 1 | 5 | 10 | 15 | 20 | 30;
    const [selectedDate, setSelectedDate] = React.useState<Date>(() => {
        if (isInitialEdit && editAppointment)
            return new Date(editAppointment.start_at);
        if (draftDate) return new Date(draftDate);
        const base = getNow();
        base.setMinutes(base.getMinutes() + 60);
        return base;
    });
    const [startHM, setStartHM] = React.useState<string>(() => {
        if (isInitialEdit && editAppointment) {
            const d = new Date(editAppointment.start_at);
            return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
        }
        if (initialDraft?.startHM) return initialDraft.startHM;
        const d = new Date(selectedDate);
        return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    });
    const [endHM, setEndHM] = React.useState<string>(() => {
        if (isInitialEdit && editAppointment) {
            const d = new Date(editAppointment.end_at);
            return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
        }
        if (initialDraft?.endHM) return initialDraft.endHM;
        const mins = toMinutes(startHM) + agendaSettings.defaultDuration;
        return fromMinutes(mins);
    });
    const [endManuallyEdited, setEndManuallyEdited] = React.useState(() =>
        Boolean(isInitialEdit || initialDraft?.endHM),
    );
    const [visitType, setVisitType] = React.useState<VisitType>(
        (isInitialEdit && editAppointment
            ? editAppointment.visit_type
            : initialDraft?.visitType || 'consulta') as VisitType,
    );
    // removed: 'definir como padrão' toggle; managed in Agenda settings
    const [notes, setNotes] = React.useState<string>(
        (isInitialEdit && editAppointment && editAppointment.notes) ||
            initialDraft?.notes ||
            '',
    );
    const [reloadKey, setReloadKey] = React.useState(0);
    const [currentEdit, setCurrentEdit] = React.useState<Appointment | null>(
        editAppointment || null,
    );
    const [lastEditedId, setLastEditedId] = React.useState<number | null>(null);
    const [highlightId, setHighlightId] = React.useState<number | null>(null);
    const [conflictHighlightIds, setConflictHighlightIds] = React.useState<
        number[]
    >([]);
    const [editingHighlightId, setEditingHighlightId] = React.useState<
        number | null
    >(currentEdit?.id ?? null);
    const [pendingConflictSelection, setPendingConflictSelection] =
        React.useState(false);
    const [conflictFocusId, setConflictFocusId] = React.useState<number | null>(
        null,
    );
    const [conflictReturnDraft, setConflictReturnDraft] = React.useState<
        QuickScheduleInitialDraft | null
    >(null);
    const [showPicker, setShowPicker] = React.useState(false);
    const listRef = React.useRef<HTMLDivElement | null>(null);
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

    // Details modal for viewing completed (done) appointments
    const [detailsOpen, setDetailsOpen] = React.useState(false);
    const [detailsAppt, setDetailsAppt] = React.useState<Appointment | null>(
        null,
    );
    const { handleFinalize } = useAgendaFinalizeAction(() => {
        setReloadKey(k => k + 1);
    });
    const isEditing = !!currentEdit;
    const isConflictEditing = conflictFocusId !== null;
    const baseClientFullName = `${client.first_name} ${client.last_name}`.trim();
    const currentEditClientFullName = React.useMemo(
        () => getAppointmentClientFullName(currentEdit),
        [currentEdit],
    );

    const showSystemMessage = React.useCallback(
        (
            text: string,
            type: 'success' | 'error' | 'info' | 'warning',
            autoCloseMs?: number,
        ) => {
            try {
                window.dispatchEvent(
                    new CustomEvent('systemMessage', {
                        detail: { text, type, autoCloseMs },
                    }),
                );
            } catch {
                /* noop */
            }
        },
        [],
    );

    const resetConflictFlow = React.useCallback(() => {
        setPendingConflictSelection(false);
        setConflictFocusId(null);
        setConflictHighlightIds([]);
    }, []);

    const clearPendingConflictSelection = React.useCallback(() => {
        if (!currentEdit) {
            setPendingConflictSelection(false);
            setConflictFocusId(null);
            setConflictHighlightIds([]);
        }
    }, [currentEdit]);

    const getAutoEndHM = React.useCallback(
        (startValue: string) => {
            const startMinutes = toMinutes(startValue);
            if (!Number.isFinite(startMinutes)) return endHM;
            const maxMinutes = workTimes.endHour * 60 + workTimes.endMin;
            const nextEndMinutes = Math.min(
                maxMinutes,
                startMinutes + agendaSettings.defaultDuration,
            );
            return fromMinutes(nextEndMinutes);
        },
        [agendaSettings.defaultDuration, endHM, workTimes.endHour, workTimes.endMin],
    );

    React.useEffect(() => {
        setCurrentEdit(editAppointment || null);
    }, [editAppointment]);

    React.useEffect(() => {
        if (!currentEdit) {
            setEditingHighlightId(null);
            return;
        }
        const startDate = new Date(currentEdit.start_at);
        const endDate = new Date(currentEdit.end_at);
        setSelectedDate(startDate);
        setStartHM(`${pad2(startDate.getHours())}:${pad2(startDate.getMinutes())}`);
        setEndHM(`${pad2(endDate.getHours())}:${pad2(endDate.getMinutes())}`);
        setEndManuallyEdited(true);
        setVisitType((currentEdit.visit_type || 'consulta') as VisitType);
        setNotes(currentEdit.notes || '');
        setEditingHighlightId(currentEdit.id);
    }, [currentEdit]);

    React.useEffect(() => {
        if (!open || currentEdit) return;
        if (initialDraft?.endHM) return;
        if (endManuallyEdited) return;
        const autoEndHM = getAutoEndHM(startHM);
        if (autoEndHM !== endHM) {
            setEndHM(autoEndHM);
        }
    }, [
        currentEdit,
        endHM,
        endManuallyEdited,
        getAutoEndHM,
        initialDraft?.endHM,
        open,
        startHM,
    ]);

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
            isEdit: isEditing,
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
        resetConflictFlow();
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
    }, [onClose, refreshPendingGuard, resetConflictFlow]);

    const { saving, error, clearError, handleSave } = useQuickScheduleSave({
        selectedDate,
        startHM,
        endHM,
        visitType,
        notes,
        clientId: client.id,
        currentEdit,
        afterPersist,
        onSuccess: (updatedId, wasEdit) => {
            setReloadKey(k => k + 1);
            if (updatedId) setLastEditedId(updatedId);
            if (wasEdit && conflictFocusId !== null && conflictReturnDraft) {
                const parsedDate = new Date(conflictReturnDraft.selectedDateISO);
                if (!Number.isNaN(parsedDate.getTime())) {
                    setSelectedDate(parsedDate);
                }
                setStartHM(conflictReturnDraft.startHM);
                setEndHM(conflictReturnDraft.endHM);
                setEndManuallyEdited(true);
                setVisitType(conflictReturnDraft.visitType);
                setNotes(conflictReturnDraft.notes || '');
                setCurrentEdit(null);
                setEditingHighlightId(null);
                setConflictReturnDraft(null);
            }
            resetConflictFlow();
        },
        onImmediateClose: handleImmediateClose,
        emitGlobalErrorMessage: true,
    });

    React.useEffect(() => {
        if (currentEdit) clearError();
    }, [currentEdit, clearError]);

    React.useEffect(() => {
        if (!open || currentEdit || !initialDraft || !draftDate) return;
        setSelectedDate(new Date(draftDate));
        setStartHM(initialDraft.startHM);
        setEndHM(initialDraft.endHM);
        setEndManuallyEdited(true);
        setVisitType(initialDraft.visitType);
        setNotes(initialDraft.notes || '');
        setConflictReturnDraft(null);
        clearError();
        resetConflictFlow();
    }, [
        clearError,
        currentEdit,
        draftDate,
        initialDraft,
        open,
        resetConflictFlow,
    ]);

    React.useEffect(() => {
        if (/conflito/i.test(error || '')) {
            setPendingConflictSelection(true);
        }
    }, [error]);

    const conflictMatches = React.useMemo(() => {
        const baseDate = new Date(selectedDate);
        const startMinutes = toMinutes(startHM);
        const endMinutes = toMinutes(endHM);
        if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
            return [] as Appointment[];
        }
        const rangeStart = new Date(baseDate);
        rangeStart.setHours(
            Math.floor(startMinutes / 60),
            startMinutes % 60,
            0,
            0,
        );
        const rangeEnd = new Date(baseDate);
        rangeEnd.setHours(
            Math.floor(endMinutes / 60),
            endMinutes % 60,
            0,
            0,
        );
        const rangeStartMs = rangeStart.getTime();
        const rangeEndMs = rangeEnd.getTime();
        return dayAppointments
            .filter(appt => {
                if (currentEdit?.id === appt.id) return false;
                if (appt.status !== 'scheduled' && appt.status !== 'ongoing') {
                    return false;
                }
                const apptStartMs = new Date(appt.start_at).getTime();
                const apptEndMs = new Date(appt.end_at).getTime();
                return apptStartMs < rangeEndMs && apptEndMs > rangeStartMs;
            })
            .sort(
                (left, right) =>
                    new Date(left.start_at).getTime() -
                    new Date(right.start_at).getTime(),
            );
    }, [currentEdit?.id, dayAppointments, endHM, selectedDate, startHM]);

    React.useEffect(() => {
        if (!/conflito/i.test(error || '')) return;
        const ids = conflictMatches.map(appt => appt.id);
        setConflictHighlightIds(ids);
        const firstId = ids[0];
        if (!firstId) return;
        requestAnimationFrame(() => {
            try {
                const el = document.getElementById(`appt-card-${firstId}`);
                if (el && el.scrollIntoView) {
                    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }
            } catch {
                /* noop */
            }
        });
    }, [conflictMatches, error]);

    const visibleAppointments = React.useMemo(() => {
        if (conflictFocusId === null) return dayAppointments;
        return dayAppointments.filter(appt => appt.id === conflictFocusId);
    }, [conflictFocusId, dayAppointments]);

    const headerClientFullName =
        currentEditClientFullName || baseClientFullName;

    const headerSubtitle = React.useMemo(() => {
        if (isConflictEditing) return 'Editar compromisso';
        return undefined;
    }, [isConflictEditing]);

    const headerConflictAlert = React.useMemo(() => {
        if (!isConflictEditing) return null;
        const baseFirstName = client.first_name.trim() || 'este cliente';
        return {
            label: 'Conflito de horario',
            message: `Este compromisso esta ocupando o horario que ${baseFirstName} quer agendar. Ajuste a data/hora ou cancele para liberar o periodo.`,
        };
    }, [client.first_name, isConflictEditing]);

    const finalizeReturnContext = React.useMemo<QuickScheduleReturnContext | null>(() => {
        if (!open || client.id <= 0) return null;

        if (conflictReturnDraft) {
            return {
                kind: 'quick-schedule',
                draft: conflictReturnDraft,
            };
        }

        if (currentEdit) return null;

        return {
            kind: 'quick-schedule',
            draft: {
                clientId: client.id,
                selectedDateISO: selectedDate.toISOString(),
                startHM,
                endHM,
                visitType,
                notes,
            },
        };
    }, [
        client.id,
        conflictReturnDraft,
        currentEdit,
        endHM,
        notes,
        open,
        selectedDate,
        startHM,
        visitType,
    ]);

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
                        clientFullName={headerClientFullName}
                        isEditing={isEditing}
                        subtitle={headerSubtitle}
                        highlightName={isConflictEditing}
                        conflictAlert={headerConflictAlert}
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
                            clearError();
                            clearPendingConflictSelection();
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
                            {
                                clearError();
                                clearPendingConflictSelection();
                                setSelectedDate(
                                    d =>
                                        new Date(
                                            d.getFullYear(),
                                            d.getMonth(),
                                            d.getDate() + 1,
                                        ),
                                );
                            }
                        }
                        onToday={() => {
                            clearError();
                            clearPendingConflictSelection();
                            setSelectedDate(new Date());
                        }}
                        onOpenPicker={() => {
                            clearError();
                            setShowPicker(true);
                        }}
                    />

                    {/** Compact status switch moved next to the minicards (inside QuickScheduleDayList). Removed big toggle here to save space. **/}

                    {!isEditing && isPending && (
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
                                                openPendingActionsForAppointment(a);
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
                                clearError();
                                clearPendingConflictSelection();
                                setStartHM(val);
                                setEndManuallyEdited(false);
                                setEndHM(getAutoEndHM(val));
                            }}
                            minHour={workTimes.startHour}
                            maxHour={workTimes.endHour}
                            minHM={`${pad2(workTimes.startHour)}:${pad2(
                                workTimes.startMin,
                            )}`}
                            maxHM={`${pad2(workTimes.endHour)}:${pad2(
                                workTimes.endMin,
                            )}`}
                            stepMinutes={slotInterval}
                        />
                        <TimePicker10
                            label='Fim'
                            value={endHM}
                            onChange={val => {
                                clearError();
                                clearPendingConflictSelection();
                                setEndManuallyEdited(true);
                                setEndHM(val);
                            }}
                            minHour={workTimes.startHour}
                            maxHour={workTimes.endHour}
                            minHM={`${pad2(workTimes.startHour)}:${pad2(
                                workTimes.startMin,
                            )}`}
                            maxHM={`${pad2(workTimes.endHour)}:${pad2(
                                workTimes.endMin,
                            )}`}
                            stepMinutes={slotInterval}
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
                                onChange={e => {
                                    clearError();
                                    setVisitType(e.target.value as VisitType);
                                }}
                                style={{ padding: '6px 8px' }}
                            >
                                <option value='consulta'>Consulta</option>
                                <option value='avaliacao'>Avaliação</option>
                                <option value='retorno'>Retorno</option>
                                <option value='procedimento'>
                                    Serviço
                                </option>
                                <option value='outro'>Outro</option>
                            </select>
                        </label>
                        {/** Removed 'Definir como padrão' toggle (managed in settings) **/}
                    </div>

                    <textarea
                        value={notes}
                        onChange={e => {
                            clearError();
                            setNotes(e.target.value);
                        }}
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
                                className='ui-btn ui-btn--neutral'
                                disabled={saving}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                className={`ui-btn ${
                                    !isEditing && isSelectedPast
                                        ? 'ui-btn--disabled'
                                        : 'ui-btn--primary'
                                }`}
                                disabled={saving || (!isEditing && isSelectedPast)}
                                title={
                                    !isEditing && isSelectedPast
                                        ? 'Não é permitido agendar no passado'
                                        : undefined
                                }
                            >
                                {saving && (
                                    <span className='ui-btn__spinner' />
                                )}
                                {saving
                                    ? 'Salvando...'
                                                                        : isEditing
                                      ? 'Salvar'
                                      : 'Criar'}
                            </button>
                        </div>
                    </div>

                    <QuickScheduleDayList
                        appointments={visibleAppointments}
                        loading={dayLoading}
                        dayFilter={dayFilter}
                        onChangeFilter={setDayFilter}
                        sectionDateTitle={sectionDateTitle}
                        highlightId={highlightId}
                        conflictHighlightIds={conflictHighlightIds}
                        editingHighlightId={editingHighlightId}
                        currentEditId={currentEdit?.id ?? null}
                        listRef={listRef}
                        minimal={true}
                        onUseTime={a => {
                            const sd = new Date(a.start_at);
                            const nextStartHM = `${pad2(sd.getHours())}:${pad2(
                                sd.getMinutes(),
                            )}`;
                            setSelectedDate(sd);
                            setStartHM(nextStartHM);
                            setEndManuallyEdited(false);
                            setEndHM(getAutoEndHM(nextStartHM));
                            setCurrentEdit(null);
                            setEditingHighlightId(null);
                            resetConflictFlow();
                        }}
                        onEdit={a => {
                            if (pendingConflictSelection) {
                                setConflictReturnDraft({
                                    clientId: client.id,
                                    selectedDateISO: selectedDate.toISOString(),
                                    startHM,
                                    endHM,
                                    visitType,
                                    notes,
                                });
                            }
                            setCurrentEdit(a);
                            setEditingHighlightId(a.id);
                            if (pendingConflictSelection) {
                                setConflictFocusId(a.id);
                                setPendingConflictSelection(false);
                            }
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
                                if (currentEdit?.id === a.id) {
                                    setCurrentEdit(null);
                                    setEditingHighlightId(null);
                                    resetConflictFlow();
                                }
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
                                showSystemMessage(msg, 'error');
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
                        onFinalize={handleFinalize}
                        finalizeRequestContext={finalizeReturnContext}
                    />

                    {!isEditing && isSelectedPast && (
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
                    <style>{`@keyframes qsSpin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
                    <FloatingDatePicker
                        open={showPicker}
                        onClose={() => setShowPicker(false)}
                        selectedDate={selectedDate}
                        onChange={d => {
                            clearPendingConflictSelection();
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
