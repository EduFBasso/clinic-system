import React from 'react';
import { findFirstPendingForClient } from '../services/pending';
import {
    getAppointmentOverride,
    subscribeOverrides,
} from '../utils/appointments/overrides';
import type { ClientBasic } from '../types/ClientBasic';
import type { SharedAppointmentLike } from '../components/shared/AppointmentCard';

interface UseClientPendingParams {
    client: ClientBasic;
    now: Date;
}

interface UseClientPendingResult {
    isPendingHeuristic: boolean;
    pendingOverride: boolean;
    effectivePending: boolean;
    openPendingActions: () => void;
    tryOpenPendingElseQuick: (onNoPending: () => void) => Promise<void>;
}

// Centraliza toda a lógica de pendência (flags futuras + heurística + override assíncrono)
export function useClientPendingState({
    client,
    now,
}: UseClientPendingParams): UseClientPendingResult {
    const isScheduled = client.next_appointment_status === 'scheduled';

    const isPendingHeuristic = React.useMemo(() => {
        // Future fields probing guarded by 'in'; no TS expectation directives.
        const anyClient = client as unknown as Record<string, unknown>;
        if (
            'has_pending_appointment' in anyClient &&
            anyClient.has_pending_appointment === true
        )
            return true;
        // Caso não esteja em status scheduled mas tenhamos janela encerrada (start/end passados) e um id, tratamos também como pendente heurístico.
        const eISO = client.next_appointment_end_at;
        if (!eISO) return false;
        const e = new Date(eISO).getTime();
        if (isNaN(e) || e > now.getTime()) return false;
        if (isScheduled) return true; // scheduled + fim passado => pendente
        // Accept status null (sem atualização ainda) como heurístico se fim passou e existe id
        if (
            client.next_appointment_status == null &&
            client.next_appointment_id != null
        ) {
            return true;
        }
        return false;
    }, [client, now, isScheduled]);

    // Override: busca no servidor se nenhum dos critérios acima detectou, mas pode haver pendência "oculta"
    const [pendingOverride, setPendingOverride] = React.useState(false);
    // Marca local de resolução imediata (finalize/cancel) até que dados reais do cliente cheguem
    const [pendingResolvedLocal, setPendingResolvedLocal] =
        React.useState(false);
    // Bloqueia reentrada de pending por poucos segundos (evita flicker / respawn)
    const [pendingBlockUntil, setPendingBlockUntil] = React.useState(0);
    React.useEffect(() => {
        let cancelled = false;
        if (isPendingHeuristic) {
            if (pendingOverride) setPendingOverride(false);
            return () => {
                cancelled = true;
            };
        }
        // Only probe if not heuristic pending
        (async () => {
            const appt = await findFirstPendingForClient(client.id, now);
            if (!cancelled && appt) setPendingOverride(true);
        })();
        return () => {
            cancelled = true;
        };
    }, [isPendingHeuristic, client.id, now, pendingOverride]);

    // Observa override para o next_appointment_id (se existir)
    const overrideStatus = React.useMemo(() => {
        if (client.next_appointment_id != null) {
            const ov = getAppointmentOverride(client.next_appointment_id);
            return ov?.status;
        }
        return undefined;
    }, [client.next_appointment_id]);

    // Escuta eventos globais de resolução imediata
    React.useEffect(() => {
        function onResolved(ev: Event) {
            const detail = (ev as CustomEvent).detail as
                | { clientId?: number; status?: string }
                | undefined;
            if (!detail || typeof detail.clientId !== 'number') return;
            if (detail.clientId === client.id) {
                setPendingResolvedLocal(true);
                setPendingBlockUntil(Date.now() + 4000); // 4s de blindagem contra volta brusca
            }
        }
        window.addEventListener(
            'pending:resolved',
            onResolved as EventListener,
        );
        return () =>
            window.removeEventListener(
                'pending:resolved',
                onResolved as EventListener,
            );
    }, [client.id]);

    // Escuta mudanças em overrides para limpar pendente se status final aplicado
    React.useEffect(() => {
        if (client.next_appointment_id == null) return;
        const unsub = subscribeOverrides(ids => {
            if (ids && !ids.includes(client.next_appointment_id!)) return;
            const ov = getAppointmentOverride(client.next_appointment_id!);
            if (ov && (ov.status === 'done' || ov.status === 'canceled')) {
                setPendingResolvedLocal(true);
                setPendingBlockUntil(Date.now() + 4000);
            }
        });
        return () => {
            try {
                unsub();
            } catch {
                /* noop */
            }
        };
    }, [client.next_appointment_id]);

    // Reset local resolved flag quando dados do cliente mudam para fora de scheduled ou janela deixa de ser pendente
    React.useEffect(() => {
        if (!pendingResolvedLocal) return;
        // Se status não é mais scheduled ou end_at passa a ser > now (nova janela futura) limpamos flag
        const endISO = client.next_appointment_end_at;
        const endMs = endISO ? new Date(endISO).getTime() : NaN;
        const shouldClear =
            client.next_appointment_status !== 'scheduled' ||
            (isFinite(endMs) && endMs > now.getTime());
        if (shouldClear) {
            setPendingResolvedLocal(false);
        }
    }, [
        pendingResolvedLocal,
        client.next_appointment_status,
        client.next_appointment_end_at,
        now,
    ]);

    // Histerese de ENTRADA: aguardamos breve atraso antes de confirmar estado pendente para suavizar transições
    const entryDelayMs = 140; // ~1-2 frames perceptivos
    const [pendingStable, setPendingStable] = React.useState(false);
    const rawPending = isPendingHeuristic || pendingOverride;
    React.useEffect(() => {
        if (rawPending) {
            let cancelled = false;
            const t = setTimeout(
                () => !cancelled && setPendingStable(true),
                entryDelayMs,
            );
            return () => {
                cancelled = true;
                clearTimeout(t);
            };
        } else {
            // Saída é imediata (sem atraso) para refletir resolução instantânea
            setPendingStable(false);
        }
    }, [rawPending]);

    let effectivePending = pendingStable;
    if (overrideStatus === 'done' || overrideStatus === 'canceled') {
        effectivePending = false;
    }
    if (pendingResolvedLocal) {
        effectivePending = false;
    }
    if (effectivePending && Date.now() < pendingBlockUntil) {
        // Bloqueia reaparecimento durante janela de blindagem
        effectivePending = false;
    }

    const openPendingActions = React.useCallback(async () => {
        let sISO = client.next_appointment_start_at || undefined;
        let eISO = client.next_appointment_end_at || undefined;
        let id = client.next_appointment_id ?? undefined;
        // Se faltam dados locais, tenta uma busca server-side para recuperar o primeiro pendente
        if (!sISO || !eISO || !id) {
            const fetched = await findFirstPendingForClient(client.id, now);
            if (fetched) {
                id = fetched.id;
                sISO = fetched.start_at;
                eISO = fetched.end_at;
            }
        }
        if (!sISO || !eISO || !id) {
            try {
                window.dispatchEvent(
                    new CustomEvent('systemMessage', {
                        detail: {
                            text: 'Há uma pendência, mas não foi possível carregar detalhes. Atualize a página.',
                            type: 'warning',
                        },
                    }),
                );
            } catch {
                /* noop */
            }
            return;
        }
        const appt: SharedAppointmentLike = {
            id,
            title: client.next_appointment_title ?? undefined,
            start_at: sISO,
            end_at: eISO,
            status: 'scheduled',
            notes: client.next_appointment_notes ?? undefined,
            client_name: `${client.first_name} ${client.last_name}`.trim(),
            client: client.id,
        };
        try {
            window.dispatchEvent(
                new CustomEvent('pendingActions:open', { detail: { appt } }),
            );
        } catch {
            /* noop */
        }
    }, [client, now]);

    const tryOpenPendingElseQuick = React.useCallback(
        async (onNoPending: () => void) => {
            if (effectivePending) {
                await openPendingActions();
                return;
            }
            const appt = await findFirstPendingForClient(client.id, now);
            if (appt) {
                try {
                    window.dispatchEvent(
                        new CustomEvent('pendingActions:open', {
                            detail: { appt },
                        }),
                    );
                } catch {
                    /* noop */
                }
                return;
            }
            onNoPending();
        },
        [effectivePending, openPendingActions, client.id, now],
    );

    return {
        isPendingHeuristic,
        pendingOverride,
        effectivePending,
        openPendingActions,
        tryOpenPendingElseQuick,
    };
}
