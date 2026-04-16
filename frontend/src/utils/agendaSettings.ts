import { API_BASE } from '../config/api';

export type WorkTimes = {
    startHour: number;
    startMin: number;
    endHour: number;
    endMin: number;
};

export type DefaultDuration = 30 | 60 | 90 | 120 | 150;
export type DefaultVisitType =
    | 'consulta'
    | 'avaliacao'
    | 'retorno'
    | 'procedimento'
    | 'outro';

export type AgendaSettingsSnapshot = {
    workStart: string;
    workEnd: string;
    slotInterval: number;
    defaultDuration: DefaultDuration;
    defaultVisitType: DefaultVisitType;
    reminderEnabled: boolean;
    reminderMinutesBefore: number;
    hydrated: boolean;
};

type ProfessionalSettingsResponse = {
    work_start_hour?: number;
    work_start_minute?: number;
    work_end_hour?: number;
    work_end_minute?: number;
    slot_minutes?: number;
    default_duration_minutes?: number;
    default_visit_type?: DefaultVisitType;
    reminder_enabled?: boolean;
    reminder_minutes_before?: number;
};

type AgendaSettingsSaveInput = {
    workStart: string;
    workEnd: string;
    slotInterval: number;
    defaultDuration: DefaultDuration;
    defaultVisitType: DefaultVisitType;
    reminderEnabled: boolean;
    reminderMinutesBefore: number;
};

type LegacyPersistedSettings = {
    workStart?: string;
    workEnd?: string;
    slotInterval?: number;
    defaultDuration?: DefaultDuration;
    defaultVisitType?: DefaultVisitType;
};

const LEGACY_PERSISTED_KEYS = {
    workStart: 'agenda.workStart',
    workEnd: 'agenda.workEnd',
    slotInterval: 'agenda.slotInterval',
    defaultDuration: 'agenda.defaultDuration',
    defaultVisitType: 'defaultVisitType',
} as const;

export const DEFAULT_AGENDA_SETTINGS: AgendaSettingsSnapshot = {
    workStart: '06:00',
    workEnd: '21:00',
    slotInterval: 10,
    defaultDuration: 60,
    defaultVisitType: 'consulta',
    reminderEnabled: false,
    reminderMinutesBefore: 90,
    hydrated: false,
};

const listeners = new Set<() => void>();
let currentSettings: AgendaSettingsSnapshot = createDefaultSnapshot();
let hydratePromise: Promise<AgendaSettingsSnapshot> | null = null;

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

function pad2(value: number): string {
    return String(value).padStart(2, '0');
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function normalizeSlotInterval(value: unknown): number {
    const parsed = Number(value);
    return [5, 10, 15, 20, 30].includes(parsed)
        ? parsed
        : DEFAULT_AGENDA_SETTINGS.slotInterval;
}

function normalizeDefaultDuration(value: unknown): DefaultDuration {
    const parsed = Number(value) as DefaultDuration;
    return ([30, 60, 90, 120, 150] as const).includes(parsed)
        ? parsed
        : DEFAULT_AGENDA_SETTINGS.defaultDuration;
}

function normalizeDefaultVisitType(value: unknown): DefaultVisitType {
    switch (value) {
        case 'consulta':
        case 'avaliacao':
        case 'retorno':
        case 'procedimento':
        case 'outro':
            return value;
        default:
            return DEFAULT_AGENDA_SETTINGS.defaultVisitType;
    }
}

function normalizeTimeString(value: string, fallback: string): string {
    const [hour, minute] = parseHM(value, parseHM(fallback, [6, 0]));
    return `${pad2(clamp(hour, 0, 23))}:${pad2(clamp(minute, 0, 59))}`;
}

function formatApiTime(
    hour: unknown,
    minute: unknown,
    fallback: string,
): string {
    const parsedHour = clamp(Number(hour) || 0, 0, 24);
    const parsedMinute = clamp(Number(minute) || 0, 0, 59);
    if (parsedHour === 24) return '23:59';
    return `${pad2(parsedHour)}:${pad2(parsedMinute)}`;
}

function createDefaultSnapshot(): AgendaSettingsSnapshot {
    return { ...DEFAULT_AGENDA_SETTINGS };
}

function emitChange(): void {
    listeners.forEach(listener => listener());
}

function replaceCurrentSettings(next: AgendaSettingsSnapshot): AgendaSettingsSnapshot {
    currentSettings = next;
    emitChange();
    return currentSettings;
}

function readAccessToken(): string {
    try {
        return localStorage.getItem('accessToken') || '';
    } catch {
        return '';
    }
}

function readLegacyPersistedSettings(): LegacyPersistedSettings | null {
    try {
        const workStart = localStorage.getItem(LEGACY_PERSISTED_KEYS.workStart);
        const workEnd = localStorage.getItem(LEGACY_PERSISTED_KEYS.workEnd);
        const slotRaw = localStorage.getItem(LEGACY_PERSISTED_KEYS.slotInterval);
        const durationRaw = localStorage.getItem(LEGACY_PERSISTED_KEYS.defaultDuration);
        const visitTypeRaw = localStorage.getItem(LEGACY_PERSISTED_KEYS.defaultVisitType);
        const slotInterval = slotRaw ? normalizeSlotInterval(slotRaw) : undefined;
        const defaultDuration = durationRaw
            ? normalizeDefaultDuration(durationRaw)
            : undefined;
        const defaultVisitType = visitTypeRaw
            ? normalizeDefaultVisitType(visitTypeRaw)
            : undefined;
        if (
            !workStart &&
            !workEnd &&
            slotInterval === undefined &&
            defaultDuration === undefined &&
            defaultVisitType === undefined
        ) {
            return null;
        }
        return {
            workStart: workStart
                ? normalizeTimeString(workStart, DEFAULT_AGENDA_SETTINGS.workStart)
                : undefined,
            workEnd: workEnd
                ? normalizeTimeString(workEnd, DEFAULT_AGENDA_SETTINGS.workEnd)
                : undefined,
            slotInterval,
            defaultDuration,
            defaultVisitType,
        };
    } catch {
        return null;
    }
}

function clearLegacyPersistedSettings(): void {
    try {
        Object.values(LEGACY_PERSISTED_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    } catch {
        /* noop */
    }
}

function normalizeApiSettings(
    data: ProfessionalSettingsResponse,
): Pick<
    AgendaSettingsSnapshot,
    | 'workStart'
    | 'workEnd'
    | 'slotInterval'
    | 'defaultDuration'
    | 'defaultVisitType'
    | 'reminderEnabled'
    | 'reminderMinutesBefore'
> {
    return {
        workStart: formatApiTime(
            data.work_start_hour,
            data.work_start_minute,
            DEFAULT_AGENDA_SETTINGS.workStart,
        ),
        workEnd: formatApiTime(
            data.work_end_hour,
            data.work_end_minute,
            DEFAULT_AGENDA_SETTINGS.workEnd,
        ),
        slotInterval: normalizeSlotInterval(data.slot_minutes),
        defaultDuration: normalizeDefaultDuration(data.default_duration_minutes),
        defaultVisitType: normalizeDefaultVisitType(data.default_visit_type),
        reminderEnabled: Boolean(data.reminder_enabled ?? false),
        reminderMinutesBefore: clamp(
            Number(data.reminder_minutes_before) ||
                DEFAULT_AGENDA_SETTINGS.reminderMinutesBefore,
            1,
            1440,
        ),
    };
}

function parseTimeParts(value: string, fallback: string): {
    hour: number;
    minute: number;
} {
    const normalized = normalizeTimeString(value, fallback);
    const [hour, minute] = parseHM(normalized, parseHM(fallback, [6, 0]));
    return {
        hour: clamp(hour, 0, 23),
        minute: clamp(minute, 0, 59),
    };
}

function buildApiPayload(
    data: Pick<
        AgendaSettingsSnapshot,
        | 'workStart'
        | 'workEnd'
        | 'slotInterval'
        | 'defaultDuration'
        | 'defaultVisitType'
        | 'reminderEnabled'
        | 'reminderMinutesBefore'
    >,
): ProfessionalSettingsResponse {
    const start = parseTimeParts(data.workStart, DEFAULT_AGENDA_SETTINGS.workStart);
    const end = parseTimeParts(data.workEnd, DEFAULT_AGENDA_SETTINGS.workEnd);
    return {
        work_start_hour: start.hour,
        work_start_minute: start.minute,
        work_end_hour: end.hour,
        work_end_minute: end.minute,
        slot_minutes: normalizeSlotInterval(data.slotInterval),
        default_duration_minutes: normalizeDefaultDuration(data.defaultDuration),
        default_visit_type: normalizeDefaultVisitType(data.defaultVisitType),
        reminder_enabled: Boolean(data.reminderEnabled),
        reminder_minutes_before: clamp(
            Number(data.reminderMinutesBefore) ||
                DEFAULT_AGENDA_SETTINGS.reminderMinutesBefore,
            1,
            1440,
        ),
    };
}

async function fetchProfessionalSettings(
    init?: RequestInit,
): Promise<ProfessionalSettingsResponse> {
    const token = readAccessToken();
    if (!token) {
        throw new Error('Sessão expirada. Faça login novamente.');
    }

    const res = await fetch(`${API_BASE}/register/professionals/settings/`, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...(init?.headers || {}),
        },
    });

    if (!res.ok) {
        let detail = 'Erro ao salvar configurações.';
        try {
            const data = await res.json();
            if (typeof data?.detail === 'string') detail = data.detail;
            else if (Array.isArray(data?.non_field_errors) && data.non_field_errors[0]) {
                detail = String(data.non_field_errors[0]);
            }
        } catch {
            /* noop */
        }
        throw new Error(detail);
    }

    return (await res.json()) as ProfessionalSettingsResponse;
}

export function subscribeAgendaSettings(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function getAgendaSettingsSnapshot(): AgendaSettingsSnapshot {
    return currentSettings;
}

export function resetAgendaSettings(): AgendaSettingsSnapshot {
    hydratePromise = null;
    return replaceCurrentSettings(createDefaultSnapshot());
}

export function getWorkTimesFromSnapshot(
    snapshot: Pick<AgendaSettingsSnapshot, 'workStart' | 'workEnd'>,
): WorkTimes {
    const [sh, sm] = parseHM(snapshot.workStart, [6, 0]);
    const [eh, em] = parseHM(snapshot.workEnd, [21, 0]);
    return {
        startHour: Math.max(0, Math.min(23, sh)),
        startMin: Math.max(0, Math.min(59, sm)),
        endHour: Math.max(0, Math.min(23, eh)),
        endMin: Math.max(0, Math.min(59, em)),
    };
}

export function getWorkTimes(): WorkTimes {
    return getWorkTimesFromSnapshot(currentSettings);
}

export function getSlotInterval(): number {
    return currentSettings.slotInterval;
}

export function getDefaultDuration(): DefaultDuration {
    return currentSettings.defaultDuration;
}

export function getDefaultVisitType(): DefaultVisitType {
    return currentSettings.defaultVisitType;
}

export async function hydrateAgendaSettings(
    force = false,
): Promise<AgendaSettingsSnapshot> {
    if (hydratePromise && !force) return hydratePromise;

    hydratePromise = (async () => {
        const token = readAccessToken();

        if (!token) {
            return replaceCurrentSettings({
                ...DEFAULT_AGENDA_SETTINGS,
                hydrated: true,
            });
        }

        try {
            const response = await fetchProfessionalSettings({ method: 'GET' });
            let next: AgendaSettingsSnapshot = {
                ...DEFAULT_AGENDA_SETTINGS,
                ...normalizeApiSettings(response),
                hydrated: true,
            };

            const legacy = readLegacyPersistedSettings();
            if (legacy) {
                const migratedSnapshot: AgendaSettingsSnapshot = {
                    ...next,
                    workStart: legacy.workStart || next.workStart,
                    workEnd: legacy.workEnd || next.workEnd,
                    slotInterval: legacy.slotInterval || next.slotInterval,
                    defaultDuration:
                        legacy.defaultDuration || next.defaultDuration,
                    defaultVisitType:
                        legacy.defaultVisitType || next.defaultVisitType,
                };

                try {
                    const migratedResponse = await fetchProfessionalSettings({
                        method: 'PATCH',
                        body: JSON.stringify(buildApiPayload(migratedSnapshot)),
                    });
                    next = {
                        ...migratedSnapshot,
                        ...normalizeApiSettings(migratedResponse),
                        hydrated: true,
                    };
                    clearLegacyPersistedSettings();
                } catch {
                    next = migratedSnapshot;
                }
            }

            return replaceCurrentSettings(next);
        } catch {
            return replaceCurrentSettings({
                ...DEFAULT_AGENDA_SETTINGS,
                hydrated: true,
            });
        }
    })().finally(() => {
        hydratePromise = null;
    });

    return hydratePromise;
}

export async function saveAgendaSettings(
    input: AgendaSettingsSaveInput,
): Promise<AgendaSettingsSnapshot> {
    const normalizedInput: AgendaSettingsSnapshot = {
        ...currentSettings,
        workStart: normalizeTimeString(input.workStart, DEFAULT_AGENDA_SETTINGS.workStart),
        workEnd: normalizeTimeString(input.workEnd, DEFAULT_AGENDA_SETTINGS.workEnd),
        slotInterval: normalizeSlotInterval(input.slotInterval),
        defaultDuration: normalizeDefaultDuration(input.defaultDuration),
        defaultVisitType: normalizeDefaultVisitType(input.defaultVisitType),
        reminderEnabled: Boolean(input.reminderEnabled),
        reminderMinutesBefore: clamp(
            Number(input.reminderMinutesBefore) ||
                DEFAULT_AGENDA_SETTINGS.reminderMinutesBefore,
            1,
            1440,
        ),
        hydrated: true,
    };

    const response = await fetchProfessionalSettings({
        method: 'PATCH',
        body: JSON.stringify(buildApiPayload(normalizedInput)),
    });

    clearLegacyPersistedSettings();

    return replaceCurrentSettings({
        ...normalizedInput,
        ...normalizeApiSettings(response),
        hydrated: true,
    });
}
