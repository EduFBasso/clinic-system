// Centralized access to Agenda settings stored in localStorage

export type WorkTimes = {
    startHour: number;
    startMin: number;
    endHour: number;
    endMin: number;
};

// Reads 'HH:MM' and returns [h, m] with sensible defaults
function parseHM(
    value: string | null,
    def: [number, number],
): [number, number] {
    if (!value) return def;
    const [hS, mS] = value.split(':');
    const h = parseInt(hS ?? '', 10);
    const m = parseInt(mS ?? '', 10);
    return [isNaN(h) ? def[0] : h, isNaN(m) ? def[1] : m];
}

export function getWorkTimes(): WorkTimes {
    try {
        const [sh, sm] = parseHM(
            localStorage.getItem('agenda.workStart'),
            [6, 0],
        );
        const [eh, em] = parseHM(
            localStorage.getItem('agenda.workEnd'),
            [21, 0],
        );
        return {
            startHour: Math.max(0, Math.min(23, sh)),
            startMin: Math.max(0, Math.min(59, sm)),
            endHour: Math.max(0, Math.min(23, eh)),
            endMin: Math.max(0, Math.min(59, em)),
        };
    } catch {
        return { startHour: 6, startMin: 0, endHour: 21, endMin: 0 };
    }
}

export function getSlotInterval(): number {
    try {
        const raw = localStorage.getItem('agenda.slotInterval') || '10';
        const n = parseInt(raw, 10);
        return [5, 10, 15, 20, 30].includes(n) ? n : 10;
    } catch {
        return 10;
    }
}

// Returns one of [30,60,90,120,150]
export function getDefaultDuration(): 30 | 60 | 90 | 120 | 150 {
    try {
        const raw = localStorage.getItem('agenda.defaultDuration');
        const n = parseInt(raw || '60', 10) as 30 | 60 | 90 | 120 | 150;
        return ([30, 60, 90, 120, 150] as const).includes(n) ? n : 60;
    } catch {
        return 60;
    }
}
