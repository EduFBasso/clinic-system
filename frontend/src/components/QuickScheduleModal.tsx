import React from 'react';
import { AppModal } from './Modal/Modal';
import TimePicker10 from './TimePicker10';
import FloatingDatePicker from './FloatingDatePicker';
import QuickScheduleHeader from './quickschedule/QuickScheduleHeader';
import DateControlsHeader from './shared/DateControlsHeader';
import PendingBanner from './quickschedule/PendingBanner';
import QuickScheduleDayList, {
    type DayFilter,
} from './quickschedule/QuickScheduleDayList';
import AppointmentDetailsModal from './AppointmentDetailsModal';
import type { ClientBasic } from '../types/ClientBasic';
import type { Appointment } from '../hooks/useAppointments';
import type {
    QuickScheduleInitialDraft,
    QuickScheduleReturnContext,
} from '../types/agendaFlow';
import { useAppointmentsRange } from '../hooks/useAppointments';
import { getNow } from '../utils/now';
import { getWorkTimesFromSnapshot } from '../utils/agendaSettings';
import { usePendingGuard } from '../hooks/usePendingGuard';
import { useQuickScheduleSave } from '../hooks/useQuickScheduleSave';
import { useAgendaSettings } from '../hooks/useAgendaSettings';
import { pad2, toMinutes, fromMinutes, weekdayLabel } from '../utils/hmTime';
import { useAgendaFinalizeAction } from '../hooks/useAgendaFinalizeAction';
import { useConflictFlow } from '../hooks/useConflictFlow';
import { useAppointmentCancel } from '../hooks/useAppointmentCancel';

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
    const [editingHighlightId, setEditingHighlightId] = React.useState<
        number | null
    >(currentEdit?.id ?? null);
    const [showPicker, setShowPicker] = React.useState(false);
    const listRef = React.useRef<HTMLDivElement | null>(null);

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

    const { items: dayAppointments, loading: dayLoading } =
        useAppointmentsRange(dayStart, dayEnd, undefined, reloadKey);

    const [dayFilter, setDayFilter] = React.useState<DayFilter>('todos');

    const [detailsOpen, setDetailsOpen] = React.useState(false);
    const [detailsAppt, setDetailsAppt] = React.useState<Appointment | null>(
        null,
    );

    const { handleFinalize } = useAgendaFinalizeAction(() => {
        setReloadKey(k => k + 1);
    });

    const isEditing = !!currentEdit;
    const baseClientFullName = `${client.first_name} ${client.last_name}`.trim();
    const currentEditClientFullName = React.useMemo(
        () => getAppointmentClientFullName(currentEdit),
        [currentEdit],
    );

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

    const { found: pendingFound, refresh: refreshPendingGuard } =
        usePendingGuard({
            open,
            isEdit: isEditing,
            clientId: client.id,
        });
    const isPending = !!pendingFound;

    // --- Conflict flow state & derived values ---
    const {
        pendingConflictSelection,
        setPendingConflictSelection,
        conflictFocusId,
        setConflictFocusId,
        conflictHighlightIds,
        setConflictHighlightIds,
        conflictReturnDraft,
        setConflictReturnDraft,
        resetConflictFlow,
        clearPendingConflictSelection,
        conflictMatches,
        visibleAppointments,
        isConflictEditing,
    } = useConflictFlow({
        currentEdit,
        selectedDate,
        startHM,
        endHM,
        dayAppointments,
    });

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

    // Drive conflict highlights from save error
    React.useEffect(() => {
        if (/conflito/i.test(error || '')) {
            setPendingConflictSelection(true);
        }
    }, [error, setPendingConflictSelection]);

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
    }, [conflictMatches, error, setConflictHighlightIds]);

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
        setConflictReturnDraft,
    ]);

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

    React.useEffect(() => {
        if (!open) return;
        const onChanged = () => setReloadKey(k => k + 1);
        window.addEventListener('appointments:changed', onChanged);
        return () =>
            window.removeEventListener('appointments:changed', onChanged);
    }, [open]);

    const sectionDateTitle = React.useMemo(() => {
        const d = selectedDate;
        const dd = `${pad2(d.getDate())}/${pad2(
            d.getMonth() + 1,
        )}/${d.getFullYear()}`;
        return `${weekdayLabel(d)} — ${dd}`;
    }, [selectedDate]);

    const isSelectedPast = React.useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sel = new Date(selectedDate);
        sel.setHours(0, 0, 0, 0);
        return sel.getTime() < today.getTime();
    }, [selectedDate]);

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
            return { kind: 'quick-schedule', draft: conflictReturnDraft };
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

    const { handleCancel } = useAppointmentCancel({
        clientId: client.id,
        currentEdit,
        lastEditedId,
        setCurrentEdit,
        setEditingHighlightId,
        resetConflictFlow,
        setReloadKey,
        setLastEditedId,
        setHighlightId,
        handleImmediateClose,
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
                        onNext={() => {
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
                        }}
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

                    {!isEditing && isPending && pendingFound && (
                        <PendingBanner
                            pendingFound={pendingFound}
                            client={client as ClientMaybeNext}
                            onClose={handleImmediateClose}
                        />
                    )}

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
                                <option value='procedimento'>Serviço</option>
                                <option value='outro'>Outro</option>
                            </select>
                        </label>
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
                                        : 'ui-btn--theme'
                                }`}
                                disabled={saving || (!isEditing && isSelectedPast)}
                                title={
                                    !isEditing && isSelectedPast
                                        ? 'Não é permitido agendar no passado'
                                        : undefined
                                }
                            >
                                {saving && <span className='ui-btn__spinner' />}
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
                        onCancel={handleCancel}
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
