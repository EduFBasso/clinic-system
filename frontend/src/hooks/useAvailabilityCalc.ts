import React from 'react';
import type { Appointment } from './useAppointments';
import { formatTime } from '../utils/timeFormat';
import { getNow } from '../utils/now';
import { toISODate } from '../utils/date';
import { pad2 } from '../utils/hmTime';
import type { AgendaSettingsSnapshot } from '../utils/agendaSettings';

// ─── Pure helpers (module-level, no hook) ────────────────────────────────────

function makeDayTime(day: string, h: number, m: number) {
    return new Date(`${day}T${pad2(h)}:${pad2(m)}:00`);
}

function addMinutes(d: Date, mins: number) {
    const x = new Date(d);
    x.setMinutes(x.getMinutes() + mins);
    return x;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
    return aStart < bEnd && aEnd > bStart;
}

function toHHMM(d: Date) {
    return formatTime(d, { mode: 'local' });
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FreeSeg {
    start: Date;
    end: Date;
    lengthMin: number;
}

export interface WorkTimes {
    startHour: number;
    startMin: number;
    endHour: number;
    endMin: number;
}

export interface AvailabilityCalcParams {
    effectiveItems: Appointment[];
    selectedDay: Date;
    dayISO: string;
    workTimes: WorkTimes;
    agendaSettings: Pick<AgendaSettingsSnapshot, 'slotInterval'>;
    duration: number;
    hour: number;
    minute: number;
    editingId: number | null;
}

export interface AvailabilityCalcResult {
    busy: { start: Date; end: Date }[];
    rawBusy: { start: Date; end: Date }[];
    dayFreeSegments: FreeSeg[];
    startCandidate: Date;
    endCandidate: Date;
    workStartBound: Date;
    workEndBound: Date;
    startAllowed: boolean;
    isRetroactive: boolean;
    canSubmit: boolean;
    hourHasAnyValidMinute: Record<number, boolean>;
    hoursRange: number[];
    minutesList: number[];
    clientConflicts: Appointment[];
    hasConflict: boolean;
    startISO: string;
    endISO: string;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

const BUFFER = 30;

export function useAvailabilityCalc({
    effectiveItems,
    selectedDay,
    dayISO,
    workTimes,
    agendaSettings,
    duration,
    hour,
    minute,
    editingId,
}: AvailabilityCalcParams): AvailabilityCalcResult {
    const slotInterval = agendaSettings.slotInterval;

    const minutesList = React.useMemo(() => {
        const step = Math.max(1, Math.min(30, slotInterval));
        const arr: number[] = [];
        for (let m = 0; m < 60; m += step) arr.push(m);
        return arr;
    }, [slotInterval]);

    const hoursRange = React.useMemo(() => {
        const startH = Math.max(0, Math.min(23, workTimes.startHour));
        const endH = Math.max(startH, Math.min(23, workTimes.endHour));
        const len = endH - startH + 1;
        return Array.from({ length: len }, (_, i) => startH + i);
    }, [workTimes.startHour, workTimes.endHour]);

    const busy = React.useMemo(() => {
        const blocks = effectiveItems
            .filter(a => a.status !== 'canceled' && a.id !== editingId)
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
    }, [effectiveItems, editingId]);

    const rawBusy = React.useMemo(() => {
        return effectiveItems
            .filter(a => a.status !== 'canceled')
            .map(a => ({
                start: new Date(a.start_at),
                end: new Date(a.end_at),
            }))
            .sort((a, b) => a.start.getTime() - b.start.getTime());
    }, [effectiveItems]);

    const dayFreeSegments = React.useMemo<FreeSeg[]>(() => {
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
                if (len >= 15) segs.push({ start: new Date(cursor), end: new Date(bs), lengthMin: len });
            }
            if (be > cursor) cursor = new Date(be);
            if (cursor >= end) break;
        }
        if (cursor < end) {
            const len = (end.getTime() - cursor.getTime()) / 60000;
            if (len >= 15) segs.push({ start: new Date(cursor), end: new Date(end), lengthMin: len });
        }
        return segs.sort((a, b) => a.start.getTime() - b.start.getTime());
    }, [rawBusy, selectedDay, workTimes.startHour, workTimes.startMin, workTimes.endHour, workTimes.endMin]);

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
            !busy.some(b => overlaps(startCandidate, endCandidate, b.start, b.end)),
        [busy, startCandidate, endCandidate, workStartBound, workEndBound],
    );

    const isRetroactive = React.useMemo(() => {
        const now = getNow();
        const todayISO = toISODate(now);
        if (dayISO < todayISO) return true;
        if (dayISO > todayISO) return false;
        return startCandidate < now;
    }, [dayISO, startCandidate]);

    const canSubmit = startAllowed && !isRetroactive;

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
    }, [hoursRange, minutesList, dayISO, duration, busy, workStartBound, workEndBound]);

    const clientConflicts = React.useMemo(() => {
        const s = new Date(`${dayISO}T${toHHMM(startCandidate)}:00`);
        const e = new Date(`${dayISO}T${toHHMM(endCandidate)}:00`);
        return effectiveItems.filter(
            a =>
                a.status === 'scheduled' &&
                a.id !== editingId &&
                overlaps(s, e, new Date(a.start_at), new Date(a.end_at)),
        );
    }, [effectiveItems, dayISO, startCandidate, endCandidate, editingId]);

    const hasConflict = React.useMemo(
        () => clientConflicts.length > 0,
        [clientConflicts.length],
    );

    const startISO = React.useMemo(
        () => new Date(`${dayISO}T${toHHMM(startCandidate)}:00`).toISOString(),
        [dayISO, startCandidate],
    );
    const endISO = React.useMemo(
        () => new Date(`${dayISO}T${toHHMM(endCandidate)}:00`).toISOString(),
        [dayISO, endCandidate],
    );

    return {
        busy,
        rawBusy,
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
    };
}
