// Centralized fetch wrapper to automatically attach auth/device headers
// and handle device session invalidation responses.
// Usage: import { apiFetch } from '../utils/apiFetch';
// const data = await apiFetch('/sessions/summary');

import { API_BASE } from '../config/api';
import { getOrCreateDeviceId } from './device';

// Custom error shape so callers can differentiate
export class ApiError extends Error {
    status: number;
    code?: string;
    constructor(message: string, status: number, code?: string) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

// Event names for global auth state changes
export const AUTH_LOGOUT_EVENT = 'auth:loggedOut';

type JsonSerializable = Record<string, unknown> | unknown[];

interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
    // If true, won't trigger logout auto handling; just surfaces the error.
    suppressAutoLogout?: boolean;
    // If relative path provided, it's joined with API_BASE.
    body?: RequestInit['body'] | JsonSerializable;
}

// Back-end messages to match for device session invalidation (Portuguese messages from authentication class)
const DEVICE_SESSION_ERROR_FRAGMENTS = [
    'Sessão de dispositivo revogada',
    'Sessão de dispositivo inativa',
    'Sessão de dispositivo não encontrada',
];

function shouldTriggerDeviceLogout(status: number, bodyText: string) {
    if (status !== 401 && status !== 403) return false;
    const lower = bodyText.toLowerCase();
    return DEVICE_SESSION_ERROR_FRAGMENTS.some(f =>
        lower.includes(f.toLowerCase()),
    );
}

function performLocalLogout(reason: string) {
    try {
        localStorage.removeItem('accessToken');
    } catch {
        // ignore storage errors (quota, disabled cookies, etc.)
    }
    // Dispatch a global event so any auth context / components can react.
    window.dispatchEvent(
        new CustomEvent(AUTH_LOGOUT_EVENT, { detail: { reason } }),
    );
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}) {
    const { suppressAutoLogout, headers, ...rest } = options;
    const deviceId = getOrCreateDeviceId('device_id');
    const token =
        typeof window !== 'undefined'
            ? localStorage.getItem('accessToken')
            : null;

    const finalHeaders: Record<string, string> = {
        Accept: 'application/json',
        'X-Device-Id': deviceId,
        ...Object.fromEntries(
            Object.entries(headers || {}).map(([k, v]) => [k, String(v)]),
        ),
    };
    if (token && !finalHeaders['Authorization']) {
        finalHeaders['Authorization'] = `Bearer ${token}`;
    }
    // Ensure JSON content-type for bodies that are plain objects
    if (
        rest.body &&
        typeof rest.body === 'object' &&
        !(rest.body instanceof FormData) &&
        !(rest.body instanceof Blob)
    ) {
        if (!finalHeaders['Content-Type'])
            finalHeaders['Content-Type'] = 'application/json';
        if (finalHeaders['Content-Type'].includes('application/json')) {
            rest.body = JSON.stringify(rest.body) as unknown as BodyInit;
        }
    }

    const url = path.startsWith('http') ? path : `${API_BASE || ''}${path}`;
    let response: Response;
    // Ensure body type matches fetch signature (string, FormData, Blob, etc.)
    let fetchBody: BodyInit | null | undefined = rest.body as
        | BodyInit
        | null
        | undefined;
    if (
        rest.body &&
        typeof rest.body === 'object' &&
        !(rest.body instanceof FormData) &&
        !(rest.body instanceof Blob) &&
        !(rest.body instanceof URLSearchParams)
    ) {
        // Already stringified above if JSON; ensure string type
        if (typeof rest.body !== 'string') {
            fetchBody = JSON.stringify(rest.body) as unknown as BodyInit;
        }
    }
    try {
        response = await fetch(url, {
            ...rest,
            body: fetchBody,
            headers: finalHeaders,
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Network error';
        throw new ApiError(message, 0);
    }

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    let bodyText = '';
    let json: Record<string, unknown> | null = null;
    try {
        if (isJson) {
            json = await response.json();
            bodyText = JSON.stringify(json);
        } else {
            bodyText = await response.text();
        }
    } catch {
        // ignore parse errors
    }

    if (!response.ok) {
        if (
            !suppressAutoLogout &&
            shouldTriggerDeviceLogout(response.status, bodyText)
        ) {
            performLocalLogout('device_session_invalid');
        }
        const detail = (json && (json['detail'] as string)) || undefined;
        const msgField = (json && (json['message'] as string)) || undefined;
        const code = (json && (json['code'] as string)) || undefined;
        const message = detail || msgField || bodyText || 'Request failed';
        throw new ApiError(message, response.status, code);
    }

    return isJson ? json : bodyText;
}

// Helper for endpoints that may return empty 204
export async function apiFetchVoid(
    path: string,
    options: ApiFetchOptions = {},
) {
    const res = await apiFetch(path, options);
    return res;
}
