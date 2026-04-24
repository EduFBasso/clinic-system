import { emit } from '../../events/bus';
import { isTokenExpired } from '../jwt';

export type LogoutReason =
    | 'manual'
    | 'session_expired'
    | 'device_session_invalid';

export function hasActiveSession() {
    return !isTokenExpired(localStorage.getItem('accessToken'));
}

export function clearStoredAuth(options?: { clearNewClientId?: boolean }) {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('loggedProfessional');
    if (options?.clearNewClientId !== false) {
        localStorage.removeItem('newClientId');
    }
}

export function dispatchLogout(
    reason: LogoutReason,
    options?: {
        clearClients?: boolean;
        clearNewClientId?: boolean;
    },
) {
    clearStoredAuth({ clearNewClientId: options?.clearNewClientId });
    emit('auth:logout', { reason });
    if (options?.clearClients !== false) {
        window.dispatchEvent(new Event('clearClients'));
    }
}