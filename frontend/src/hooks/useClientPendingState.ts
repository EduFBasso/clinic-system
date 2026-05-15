import React from 'react';
import { findFirstPendingForClient } from '../services/pending';
import { openPendingActionsForAppointment } from '../utils/appointments/openPendingActions';
import type { ClientBasic } from '../types/ClientBasic';
import type { PendingReturnContext } from '../types/agendaFlow';

interface UseClientPendingParams {
    client: ClientBasic;
    now: Date;
    /** Habilita consulta HTTP por cliente para detectar pendências não capturadas pela heurística.
     *  Padrão false — deixar false em listas grandes para evitar N×2 requests simultâneos. */
    probeEnabled?: boolean;
}

interface UseClientPendingResult {
    isPendingHeuristic: boolean;
    pendingOverride: boolean;
    effectivePending: boolean;
    openPendingActions: (returnContext?: PendingReturnContext) => void;
    tryOpenPendingElseQuick: (
        onNoPending: () => void,
        returnContext?: PendingReturnContext,
    ) => Promise<void>;
}

// Centraliza toda a lógica de pendência (flags futuras + heurística + override assíncrono)
export function useClientPendingState({
    client,
    now,
    probeEnabled = false,
}: UseClientPendingParams): UseClientPendingResult {
    // Ref keeps the current `now` accessible inside effects without adding it to dep arrays
    // (avoids re-running network effects every 5 s on each clock tick)
    const nowRef = React.useRef(now);
    nowRef.current = now;

    const isPendingHeuristic = React.useMemo(() => {
        // Future fields probing guarded by 'in'; no TS expectation directives.
        const anyClient = client as unknown as Record<string, unknown>;
        if (
            'has_pending_appointment' in anyClient &&
            anyClient.has_pending_appointment === true
        )
            return true;

        if (
            client.next_appointment_status === 'pending' ||
            client.last_appointment_status === 'pending'
        ) {
            return true;
        }

        return false;
    }, [client]);

    // Probe override: set when API confirms a pending appointment not visible via heuristic
    const [pendingOverride, setPendingOverride] = React.useState(false);
    // Marca local de resolução imediata (finalize/cancel) até que dados reais do cliente cheguem
    const [pendingResolvedLocal, setPendingResolvedLocal] =
        React.useState(false);
    // Bloqueia reentrada de pending por poucos segundos (evita flicker / respawn)
    const [pendingBlockUntil, setPendingBlockUntil] = React.useState(0);
    React.useEffect(() => {
        let cancelled = false;
        if (isPendingHeuristic) {
            return () => { cancelled = true; };
        }
        if (!probeEnabled) {
            return () => { cancelled = true; };
        }
        (async () => {
            const appt = await findFirstPendingForClient(
                client.id,
                nowRef.current,
            );
            if (!cancelled && appt) setPendingOverride(true);
        })();
        return () => {
            cancelled = true;
        };
    }, [isPendingHeuristic, client.id, probeEnabled]);

    // Escuta eventos globais de resolução imediata
    React.useEffect(() => {
        function onResolved(ev: Event) {
            const detail = (ev as CustomEvent).detail as
                | { clientId?: number; status?: string }
                | undefined;
            if (!detail || typeof detail.clientId !== 'number') return;
            if (detail.clientId === client.id) {
                setPendingOverride(false); // limpa override para rawPending = false imediatamente
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

    // Escuta mudanças de status: se o appointment do cliente foi para done/canceled,
    // dispara resolução local imediata
    React.useEffect(() => {
        const status = client.next_appointment_status;
        if (status === 'done' || status === 'canceled') {
            setPendingOverride(false);
            setPendingResolvedLocal(true);
            setPendingBlockUntil(Date.now() + 4000);
        }
    }, [client.next_appointment_status]);

    // Reset local resolved flag quando dados do cliente confirmam estado terminal
    React.useEffect(() => {
        if (!pendingResolvedLocal) return;
        const shouldClear =
            client.next_appointment_status === 'done' ||
            client.next_appointment_status === 'canceled';
        if (shouldClear) {
            setPendingResolvedLocal(false);
        }
    }, [
        pendingResolvedLocal,
        client.next_appointment_status,
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
    if (pendingResolvedLocal) {
        effectivePending = false;
    }
    if (effectivePending && Date.now() < pendingBlockUntil) {
        // Bloqueia reaparecimento durante janela de blindagem
        effectivePending = false;
    }

    const openPendingActions = React.useCallback(async (returnContext?: PendingReturnContext) => {
        let sISO = client.next_appointment_start_at || undefined;
        let eISO = client.next_appointment_end_at || undefined;
        let id = client.next_appointment_id ?? undefined;

        // Caso estejamos em estado pendente mas o "next" local aponta para o futuro,
        // precisamos buscar o compromisso passado (fim <= now) que realmente originou a pendência.
        const nowMs = now.getTime();
        const startMs = sISO ? new Date(sISO).getTime() : NaN;
        const endMs = eISO ? new Date(eISO).getTime() : NaN;
        const windowIsFuture =
            (isFinite(startMs) && startMs > nowMs) ||
            (isFinite(endMs) && endMs > nowMs);

        if (effectivePending && (windowIsFuture || !sISO || !eISO || !id)) {
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

        openPendingActionsForAppointment(id, returnContext);
    }, [client, now, effectivePending]);

    const tryOpenPendingElseQuick = React.useCallback(
        async (
            onNoPending: () => void,
            returnContext?: PendingReturnContext,
        ) => {
            if (effectivePending) {
                await openPendingActions(returnContext);
                return;
            }
            const appt = await findFirstPendingForClient(client.id, now);
            if (appt) {
                openPendingActionsForAppointment(appt, returnContext);
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
