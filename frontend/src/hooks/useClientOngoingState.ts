import type { ClientBasic } from '../types/ClientBasic';

interface Params {
    client: ClientBasic;
    now: Date;
    enableProbe: boolean;
    debug?: boolean;
}

export interface UseClientOngoingStateResult {
    isOngoing: boolean;
    isOngoingRaw: boolean;
    displayStartISO: string | null;
    displayEndISO: string | null;
    effectiveApptId: number | null;
    suppress(ms: number): void;
    afterFinalizeSuccess(): void;
    hasTrustedWindow: boolean;
    latchedId: number | null;
}

/**
 * Ongoing state for a ClientCard.
 * Since the backend now persists `ongoing` as a real status (promoted
 * opportunistically on list/next_for_client), this hook reads the value
 * directly from `client.next_appointment_status`. No localStorage latch,
 * no sweep, no in-memory override needed.
 */
export function useClientOngoingState({
    client,
}: Params): UseClientOngoingStateResult {
    const isOngoing = client.next_appointment_status === 'ongoing';

    const displayStartISO = isOngoing
        ? (client.next_appointment_start_at ?? null)
        : null;
    const displayEndISO = isOngoing
        ? (client.next_appointment_end_at ?? null)
        : null;
    const effectiveApptId = isOngoing
        ? (client.next_appointment_id ?? null)
        : null;

    return {
        isOngoing,
        isOngoingRaw: isOngoing,
        displayStartISO,
        displayEndISO,
        effectiveApptId,
        suppress: () => {},
        afterFinalizeSuccess: () => {},
        hasTrustedWindow: isOngoing,
        latchedId: null,
    };
}
