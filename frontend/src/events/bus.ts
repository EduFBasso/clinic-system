// Central typed event bus helpers
// This creates a single source of truth for custom event names and payload shapes.
// Usage:
// import { emit, on, off, events } from '../events/bus';
// emit('systemMessage', { text: 'Hello', type: 'success' });
// const dispose = on('openAppointmentDetails', detail => { ... });

import type { Appointment } from '../hooks/useAppointments';
import type {
    PendingActionsOpenDetail,
    PendingReturnContext,
} from '../types/agendaFlow';

export type SystemMessagePayload = {
    text: string;
    type: 'success' | 'error' | 'info' | 'warning';
};
export type OpenAppointmentDetailsPayload = {
    appointment: Appointment;
    returnContext?: PendingReturnContext;
};
export type ScrollToClientCardPayload = { clientId: number };
export type OpenDailyAgendaPayload =
    | {
          date?: string;
          focusAppointmentId?: number;
      }
    | undefined; // ISO date optional
export type AgendaSettingsUpdatedPayload = undefined;
export type AppointmentsChangedPayload = undefined;
export type PendingActionsForceClosePayload = undefined;
export type EnsureScrollUnlockedPayload = undefined;
export type AuthLoginPayload = undefined;
export type AuthLogoutPayload = {
    reason?: 'manual' | 'session_expired' | 'device_session_invalid';
};
export type PendingResolvedPayload = {
    clientId: number;
    status: 'done' | 'canceled';
};
export type ClientClearOngoingPayload = { clientId: number };
export type AppointmentStatusChangedPayload = {
    id?: number;
    status?: string;
    start_at?: string;
    end_at?: string;
    locallyShortened?: boolean;
};
export type ModalClosedPayload = {
    type: string;
    id?: number;
};

// Extend here as needed
export interface EventMap {
    systemMessage: SystemMessagePayload;
    openAppointmentDetails: OpenAppointmentDetailsPayload;
    scrollToClientCard: ScrollToClientCardPayload;
    openDailyAgenda: OpenDailyAgendaPayload;
    agendaSettingsUpdated: AgendaSettingsUpdatedPayload;
    'appointments:changed': AppointmentsChangedPayload;
    'auth:login': AuthLoginPayload;
    'auth:logout': AuthLogoutPayload;
    'pendingActions:open': PendingActionsOpenDetail;
    'pendingActions:forceClose': PendingActionsForceClosePayload;
    'pending:resolved': PendingResolvedPayload;
    'client:clearOngoing': ClientClearOngoingPayload;
    'appointment:statusChanged': AppointmentStatusChangedPayload;
    'modal:closed': ModalClosedPayload;
    ensureScrollUnlocked: EnsureScrollUnlockedPayload;
}

export const events: (keyof EventMap)[] = [
    'systemMessage',
    'openAppointmentDetails',
    'scrollToClientCard',
    'openDailyAgenda',
    'agendaSettingsUpdated',
    'appointments:changed',
    'auth:login',
    'auth:logout',
    'pendingActions:open',
    'pendingActions:forceClose',
    'pending:resolved',
    'client:clearOngoing',
    'appointment:statusChanged',
    'modal:closed',
    'ensureScrollUnlocked',
];

// Emit helper
export function emit<K extends keyof EventMap>(name: K, detail: EventMap[K]) {
    try {
        window.dispatchEvent(
            new CustomEvent(name, { detail } as CustomEventInit<EventMap[K]>),
        );
    } catch {
        /* noop */
    }
}

// Listener helper returns disposer
export function on<K extends keyof EventMap>(
    name: K,
    handler: (detail: EventMap[K]) => void,
) {
    const wrapped = (e: Event) => {
        const ce = e as CustomEvent<EventMap[K]>;
        handler(ce.detail as EventMap[K]);
    };
    window.addEventListener(name, wrapped as EventListener);
    return () => off(name, wrapped as EventListener);
}

export function off<K extends keyof EventMap>(name: K, handler: EventListener) {
    window.removeEventListener(name, handler);
}

// One-time listener
export function once<K extends keyof EventMap>(
    name: K,
    handler: (detail: EventMap[K]) => void,
) {
    const dispose = on(name, d => {
        dispose();
        handler(d);
    });
    return dispose;
}

// Await an event as Promise
export function waitFor<K extends keyof EventMap>(
    name: K,
    timeoutMs?: number,
): Promise<EventMap[K]> {
    return new Promise((resolve, reject) => {
        const dispose = on(name, detail => {
            if (timer) clearTimeout(timer);
            resolve(detail);
        });
        let timer: ReturnType<typeof setTimeout> | null = null;
        if (timeoutMs) {
            timer = setTimeout(() => {
                dispose();
                reject(new Error(`Timeout waiting for event ${name}`));
            }, timeoutMs);
        }
    });
}
