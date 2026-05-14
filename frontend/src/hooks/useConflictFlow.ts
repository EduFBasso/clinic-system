import React from 'react';
import type { Appointment } from './useAppointments';
import type { QuickScheduleInitialDraft } from '../types/agendaFlow';
import { toMinutes } from '../utils/hmTime';

interface UseConflictFlowParams {
    currentEdit: Appointment | null;
    selectedDate: Date;
    startHM: string;
    endHM: string;
    dayAppointments: Appointment[];
}

interface UseConflictFlowResult {
    pendingConflictSelection: boolean;
    setPendingConflictSelection: React.Dispatch<React.SetStateAction<boolean>>;
    conflictFocusId: number | null;
    setConflictFocusId: React.Dispatch<React.SetStateAction<number | null>>;
    conflictHighlightIds: number[];
    setConflictHighlightIds: React.Dispatch<React.SetStateAction<number[]>>;
    conflictReturnDraft: QuickScheduleInitialDraft | null;
    setConflictReturnDraft: React.Dispatch<
        React.SetStateAction<QuickScheduleInitialDraft | null>
    >;
    resetConflictFlow: () => void;
    clearPendingConflictSelection: () => void;
    conflictMatches: Appointment[];
    visibleAppointments: Appointment[];
    isConflictEditing: boolean;
}

export function useConflictFlow({
    currentEdit,
    selectedDate,
    startHM,
    endHM,
    dayAppointments,
}: UseConflictFlowParams): UseConflictFlowResult {
    const [pendingConflictSelection, setPendingConflictSelection] =
        React.useState(false);
    const [conflictFocusId, setConflictFocusId] = React.useState<number | null>(
        null,
    );
    const [conflictHighlightIds, setConflictHighlightIds] = React.useState<
        number[]
    >([]);
    const [conflictReturnDraft, setConflictReturnDraft] =
        React.useState<QuickScheduleInitialDraft | null>(null);

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

    const visibleAppointments = React.useMemo(() => {
        if (conflictFocusId === null) return dayAppointments;
        return dayAppointments.filter(appt => appt.id === conflictFocusId);
    }, [conflictFocusId, dayAppointments]);

    const isConflictEditing = conflictFocusId !== null;

    return {
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
    };
}
