import React from 'react';
import { useNavigate } from 'react-router-dom';
import AppModal from './Modal';
import type { SharedAppointmentLike } from './shared/AppointmentCard';
import { dispatchers } from '../events/dispatchers';
import { emit } from '../events/bus';
import { cancelFlow } from '../services/flows/cancelFlow';
import { finalizeFlow } from '../services/flows/finalizeFlow';
import { formatTime } from '../utils/timeFormat';
import { API_BASE } from '../config/api';
import { apiFetch } from '../utils/apiFetch';
import type { PendingReturnContext } from '../types/agendaFlow';
import { step, debugLog, isStepEnabled } from '../debug/stepper';
import { postDone } from '../services/appointments';

interface PendingActionsModalProps {
    open: boolean;
    onClose: () => void;
    appt: SharedAppointmentLike | null;
    returnContext?: PendingReturnContext;
}

type AppointmentCharge = {
    id: number;
    status: string;
    paid_at?: string | null;
    items?: Array<{
        paid?: boolean;
        paid_at?: string | null;
    }>;
};

const actionBtnBaseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 40,
    padding: '8px 12px',
    borderRadius: 'var(--btn-radius)',
    borderWidth: 1,
    borderStyle: 'solid',
    fontSize: 'var(--font-body)',
    fontWeight: 'var(--btn-font-weight)',
    lineHeight: 1,
};

const actionBtnSecondaryStyle: React.CSSProperties = {
    background: 'var(--btn-secondary-bg)',
    borderColor: 'var(--btn-secondary-border)',
    color: 'var(--btn-secondary-text)',
};

const actionBtnDangerStyle: React.CSSProperties = {
    background: 'var(--btn-danger-bg)',
    borderColor: 'var(--btn-danger-border)',
    color: 'var(--btn-danger-text)',
};

const actionBtnDisabledStyle: React.CSSProperties = {
    background: 'var(--btn-disabled-bg)',
    borderColor: 'var(--btn-disabled-border)',
    color: 'var(--btn-disabled-text)',
    opacity: 0.72,
    cursor: 'not-allowed',
};

export default function PendingActionsModal({
    open,
    onClose,
    appt,
    returnContext,
}: PendingActionsModalProps) {
    const [busy, setBusy] = React.useState<'cancel' | 'finalize' | 'finalize-no-record' | null>(null);
    const [closing, setClosing] = React.useState(false);
    const [errorText, setErrorText] = React.useState<string | null>(null);
    const [hasPaidCharge, setHasPaidCharge] = React.useState(false);
    React.useEffect(() => {
        if (!open || !appt) {
            setHasPaidCharge(false);
            return;
        }
        let mounted = true;
        apiFetch(`${API_BASE}/agenda/charges/?appointment=${appt.id}`)
            .then(data => {
                if (!mounted) return;
                const raw = data as
                    | { results?: AppointmentCharge[] }
                    | AppointmentCharge[];
                const charges = Array.isArray(raw)
                    ? raw
                    : ((raw as { results?: AppointmentCharge[] }).results ??
                      []);
                const paidDetected = charges.some(charge => {
                    if (charge.status === 'paid' || !!charge.paid_at) {
                        return true;
                    }
                    return (charge.items ?? []).some(
                        item => item.paid || !!item.paid_at,
                    );
                });
                setHasPaidCharge(paidDetected);
            })
            .catch(() => {
                if (mounted) setHasPaidCharge(false);
            });
        return () => {
            mounted = false;
        };
    }, [open, appt]);

    React.useEffect(() => {
        if (!appt) return undefined;
    }, [appt, open, onClose]);

    async function sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // fetchApptStatus removido: novo fluxo não bloqueia aguardando polling.

    // Poll helpers antigos removidos; confirmação agora é otimista e feita em background leve (não bloqueia UI)

    const instanceIdRef = React.useRef<string>(
        Math.random().toString(36).slice(2),
    );
    const instanceId = instanceIdRef.current;
    React.useEffect(() => {
        try {
            debugLog('PendingActions: open change', {
                open,
                apptId: appt?.id,
                instanceId,
            });
        } catch {
            /* noop */
        }
    }, [open, appt?.id, instanceId]);

    // Removed global singleton guard; centralized opening is now handled in Home via 'pendingActions:open' events

    // If modal receives a terminal appointment (e.g., canceled/done), auto-close defensively.
    React.useEffect(() => {
        if (!open || !appt) return;
        const st = (appt as SharedAppointmentLike).status as string | undefined;
        if (
            st &&
            st.toLowerCase() !== 'scheduled' &&
            st.toLowerCase() !== 'ongoing' &&
            st.toLowerCase() !== 'pending'
        ) {
            try {
                debugLog(
                    'PendingActions: auto-close due to terminal status',
                    {
                        status: st,
                        id: appt.id,
                    },
                );
            } catch {
                /* noop */
            }
            try {
                onClose();
            } catch {
                /* noop */
            }
            try {
                window.dispatchEvent(new Event('pendingActions:forceClose'));
                window.dispatchEvent(new Event('ensureScrollUnlocked'));
            } catch {
                /* noop */
            }
        }
    }, [open, appt, onClose]);

    const navigate = useNavigate();
    if (!appt) return null;
    // Regra revisada: permitir finalizar assim que o compromisso INICIA (antes o bloqueio aguardava o fim)
    // Mantém bloqueio apenas se ainda não chegou no horário de início.
    // Em casos de inconsistência (end < start) ou horário invertido, liberamos finalize imediatamente.
    const startPlannedMs = new Date(appt.start_at).getTime();
    const endPlannedMs = new Date(appt.end_at).getTime();
    const nowMsForButtons = Date.now();
    const inconsistentWindow =
        !Number.isNaN(startPlannedMs) && !Number.isNaN(endPlannedMs)
            ? endPlannedMs < startPlannedMs
            : false;
    const finalizeTimeLock =
        appt.status === 'scheduled' && !Number.isNaN(startPlannedMs)
            ? !inconsistentWindow && nowMsForButtons < startPlannedMs
            : false;
    const finalizeDisabled = !!busy || closing || finalizeTimeLock;
    const cancelDisabled = !!busy || closing;
    const apptId = appt.id; // safe after null check
    const apptClientId =
        typeof appt.client === 'number'
            ? appt.client
            : appt.client && 'id' in appt.client
              ? (appt.client as { id: number }).id
              : undefined;

    const clientName =
        appt.client_name ||
        (typeof appt.client === 'object' && appt.client && 'name' in appt.client
            ? String((appt.client as { name?: string }).name || 'Cliente')
            : 'Cliente');

    const s = new Date(appt.start_at);
    const e = new Date(appt.end_at);
    const timeRange = (() => {
        const weekday = s
            .toLocaleDateString('pt-BR', { weekday: 'short' })
            .replace('.', '');
        const day = String(s.getDate()).padStart(2, '0');
        const month = String(s.getMonth() + 1).padStart(2, '0');
        const sh = formatTime(s, { mode: 'local' });
        const eh = formatTime(e, { mode: 'local' });
        return `${weekday} ${day}/${month}, ${sh} - ${eh}`;
    })();

    const realClosedLine: string | null = null;

    async function doCancel() {
        if (busy) return;
        setBusy('cancel');
        setErrorText(null);
        try {
            // Regra: não permitir cancelamento antes do compromisso iniciar
            try {
                // appt é garantido não-nulo acima (return null early), mas TS não infere dentro deste escopo
                const startMs = new Date(appt!.start_at).getTime();
                const nowMs = Date.now();
                if (!Number.isNaN(startMs) && nowMs < startMs) {
                    setErrorText(
                        'Cancelamento só é permitido após o início do atendimento.',
                    );
                    debugLog('PendingActions: cancel blocked (not started)', {
                        start_at: appt!.start_at,
                        now: new Date().toISOString(),
                    });
                    setBusy(null);
                    return; // aborta fluxo de cancelamento
                }
            } catch {
                /* ignore guard errors; fallback para fluxo normal */
            }
            const id = apptId;
            // Step with a timeout safety: auto-continue after 4s if something blocks user input
            await Promise.race([
                step('PendingActions: doCancel start', { id, instanceId }),
                (async () => {
                    if (!isStepEnabled()) return;
                    await sleep(4000);
                    debugLog('PendingActions: step timeout (auto-continue)');
                })(),
            ]);
            // Cancelar com reforço de sessão e diagnóstico
            const resp = await cancelFlow(id);
            debugLog('PendingActions: cancelFlow response', resp);
            // Ajuste local imediato: se estava em andamento e backend ainda não encurtou end_at (response original ainda mostra fim futuro)
            try {
                if (resp.ok && resp.status === 200 && appt) {
                    const nowMs = Date.now();
                    const startMs = new Date(appt.start_at).getTime();
                    const endMs = new Date(appt.end_at).getTime();
                    const wasInProgress =
                        !Number.isNaN(startMs) &&
                        !Number.isNaN(endMs) &&
                        startMs <= nowMs &&
                        nowMs < endMs;
                    if (wasInProgress) {
                        const adjustedEndIso = new Date(nowMs).toISOString();
                        window.dispatchEvent(
                            new CustomEvent('appointment:statusChanged', {
                                detail: {
                                    id: appt.id,
                                    status: 'canceled',
                                    start_at: appt.start_at,
                                    end_at: adjustedEndIso,
                                    locallyShortened: true,
                                },
                            }),
                        );
                        debugLog(
                            'PendingActions: dispatched local shortened end_at after cancel',
                            {
                                apptId: appt.id,
                                adjustedEndIso,
                            },
                        );
                    }
                }
            } catch {
                /* noop local shorten */
            }
            if (!resp.ok) {
                const friendly =
                    resp.status === 403
                        ? 'Sem permissão para cancelar este agendamento (403).'
                        : resp.status === 401
                          ? 'Sessão expirada (401).'
                          : `Falha ao cancelar: ${resp.error || resp.status}`;
                throw new Error(friendly);
            }
            // Evento de resolução imediata (pendente -> estado final) para limpar UI do ClientCard
            try {
                if (typeof apptClientId === 'number') {
                    window.dispatchEvent(
                        new CustomEvent('pending:resolved', {
                            detail: {
                                clientId: apptClientId,
                                status: 'canceled',
                            },
                        }),
                    );
                }
            } catch {
                /* noop */
            }
            // Feche este modal primeiro para evitar empilhamento (close-first)
            setClosing(true);
            try {
                console.debug('[PendingActions] onClose (after cancel)', {
                    apptId,
                    instanceId,
                });
            } catch {
                /* noop */
            }
            await Promise.race([
                step('PendingActions: before onClose (cancel)', {
                    id,
                    closing: true,
                }),
                (async () => {
                    if (!isStepEnabled()) return;
                    await sleep(4000);
                    debugLog('PendingActions: step timeout (auto-continue)');
                })(),
            ]);
            onClose();
            try {
                window.dispatchEvent(new Event('pendingActions:forceClose'));
                debugLog('PendingActions: forceClose dispatched');
                window.dispatchEvent(
                    new CustomEvent('modal:closed', {
                        detail: { type: 'pendingActions', id },
                    }),
                );
            } catch {
                /* noop */
            }
            // Após pequeno delay, emita atualizações e mostre confirmação
            setTimeout(() => {
                try {
                    // Atualizações: coalesce refresh para evitar bursts
                    dispatchers.appointmentsChanged();
                    dispatchers.updateClients();
                    localStorage.setItem(
                        'appointments.changed',
                        String(Date.now()),
                    );
                    debugLog('PendingActions: refresh events dispatched');
                } catch {
                    /* noop */
                }
                // Clear ongoing latch for this client (evita visual colado)
                try {
                    if (typeof apptClientId === 'number') {
                        window.dispatchEvent(
                            new CustomEvent('client:clearOngoing', {
                                detail: { clientId: apptClientId },
                            }),
                        );
                        debugLog(
                            'PendingActions: client:clearOngoing dispatched',
                            {
                                clientId: apptClientId,
                            },
                        );
                    }
                } catch {
                    /* noop */
                }
                try {
                    window.dispatchEvent(
                        new CustomEvent('systemMessage', {
                            detail: {
                                text: 'Compromisso cancelado.',
                                type: 'success',
                            },
                        }),
                    );
                    // Garantia adicional de desbloqueio de scroll
                    window.dispatchEvent(new Event('ensureScrollUnlocked'));
                    debugLog('PendingActions: systemMessage success (cancel)');
                } catch {
                    /* noop */
                }
                // Fallback: reforça desbloqueio pouco depois
                setTimeout(() => {
                    try {
                        window.dispatchEvent(new Event('ensureScrollUnlocked'));
                        debugLog(
                            'PendingActions: ensureScrollUnlocked (fallback)',
                        );
                    } catch {
                        /* noop */
                    }
                }, 120);
            }, 120);
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Falha ao cancelar';
            try {
                // Telemetry opcional para depuração de casos em produção
                console.warn('[PendingActions] cancel failed', { apptId, msg });
                debugLog('PendingActions: cancel failed', { apptId, msg });
            } catch {
                /* noop */
            }
            try {
                window.dispatchEvent(
                    new CustomEvent('systemMessage', {
                        detail: { text: msg, type: 'error' },
                    }),
                );
                window.dispatchEvent(new Event('ensureScrollUnlocked'));
                debugLog('PendingActions: systemMessage error (cancel)', {
                    msg,
                });
            } catch {
                /* noop */
            }
            setErrorText(msg);
        } finally {
            setBusy(null);
            setClosing(false);
            debugLog('PendingActions: doCancel finally');
        }
    }

    async function doFinalize() {
        if (busy) return;
        setBusy('finalize');
        setErrorText(null);
        // Captura antes de qualquer operação async (props podem mudar)
        const capturedStatus = appt?.status ?? 'scheduled';
        const capturedClientName = clientName;
        const capturedStartAt = appt?.start_at ?? '';
        const capturedEndAt = appt?.end_at ?? '';
        try {
            const id = apptId;
            await Promise.race([
                step('PendingActions: doFinalize start', { id, instanceId }),
                (async () => {
                    if (!isStepEnabled()) return;
                    await sleep(4000);
                    debugLog('PendingActions: step timeout (auto-continue)');
                })(),
            ]);
            const res =
                capturedStatus === 'pending'
                    ? { ok: true, status: 200 }
                    : await finalizeFlow(id);
            debugLog('PendingActions: finalizeFlow response', res);
            if (!res.ok) throw new Error(res.error || 'Falha ao finalizar');
            // Dispara eventos de atualização com pequeno backoff para evitar corrida
            try {
                // Coalesce refresh events to avoid bursts
                dispatchers.appointmentsChanged();
                dispatchers.updateClients();
                try {
                    localStorage.setItem(
                        'appointments.changed',
                        String(Date.now()),
                    );
                } catch {
                    /* noop */
                }
                // Clear ongoing latch for this client in the same tab (evita visual colado)
                if (typeof apptClientId === 'number') {
                    window.dispatchEvent(
                        new CustomEvent('client:clearOngoing', {
                            detail: { clientId: apptClientId },
                        }),
                    );
                    debugLog(
                        'PendingActions: client:clearOngoing dispatched (finalize)',
                        {
                            clientId: apptClientId,
                        },
                    );
                }
            } catch {
                /* noop */
            }
            // Feche primeiro este modal; depois mensagem
            setClosing(true);
            await Promise.race([
                step('PendingActions: before onClose (finalize)', {
                    id,
                    closing: true,
                }),
                (async () => {
                    if (!isStepEnabled()) return;
                    await sleep(4000);
                    debugLog('PendingActions: step timeout (auto-continue)');
                })(),
            ]);
            onClose();
            setTimeout(() => {
                try {
                    window.dispatchEvent(new Event('ensureScrollUnlocked'));
                } catch {
                    /* noop */
                }
                // Fecha todos os modais de agenda antes de navegar (evita fundo vazando)
                try {
                    emit('agenda:closeAll', undefined);
                } catch {
                    /* noop */
                }
                // Navega para ConsultaPage com dados do atendimento
                try {
                    navigate('/consulta', {
                        state: {
                            appointmentId: id,
                            clientName: capturedClientName,
                            clientId:
                                typeof apptClientId === 'number'
                                    ? apptClientId
                                    : undefined,
                            startAt: capturedStartAt,
                            endAt: capturedEndAt,
                            returnContext,
                        },
                    });
                    debugLog('PendingActions: navigate to consulta', {
                        id,
                        status: capturedStatus,
                    });
                } catch {
                    /* noop */
                }
                setTimeout(() => {
                    try {
                        window.dispatchEvent(new Event('ensureScrollUnlocked'));
                        debugLog(
                            'PendingActions: ensureScrollUnlocked (finalize fallback)',
                        );
                    } catch {
                        /* noop */
                    }
                }, 120);
            }, 120);
        } catch (e) {
            const msg =
                e instanceof Error ? e.message : 'Falha ao abrir consulta';
            try {
                window.dispatchEvent(
                    new CustomEvent('systemMessage', {
                        detail: { text: msg, type: 'error' },
                    }),
                );
                window.dispatchEvent(new Event('ensureScrollUnlocked'));
                debugLog('PendingActions: systemMessage error (finalize)', {
                    msg,
                });
            } catch {
                /* noop */
            }
        } finally {
            setBusy(null);
            setClosing(false);
            debugLog('PendingActions: doFinalize finally');
        }
    }

    async function doFinalizeWithoutRecord() {
        if (busy) return;
        setBusy('finalize-no-record');
        setErrorText(null);
        const capturedStatus = appt?.status ?? 'scheduled';
        try {
            const id = apptId;
            // Se ainda não está pending, finaliza primeiro (scheduled → pending)
            if (capturedStatus !== 'pending') {
                const res = await finalizeFlow(id);
                debugLog('PendingActions: finalizeFlow response (no-record)', res);
                if (!res.ok) throw new Error(res.error || 'Falha ao finalizar');
            }
            // Conclui direto (pending → done) sem criar Charge
            const done = await postDone(id);
            debugLog('PendingActions: postDone response (no-record)', done);
            if (!done) throw new Error('Falha ao concluir atendimento');
            // Atualiza estado local
            try {
                dispatchers.appointmentsChanged();
                dispatchers.updateClients();
                try {
                    localStorage.setItem(
                        'appointments.changed',
                        String(Date.now()),
                    );
                } catch {
                    /* noop */
                }
                if (typeof apptClientId === 'number') {
                    window.dispatchEvent(
                        new CustomEvent('client:clearOngoing', {
                            detail: { clientId: apptClientId },
                        }),
                    );
                    debugLog(
                        'PendingActions: client:clearOngoing dispatched (no-record)',
                        { clientId: apptClientId },
                    );
                }
            } catch {
                /* noop */
            }
            setClosing(true);
            onClose();
            setTimeout(() => {
                try {
                    window.dispatchEvent(new Event('ensureScrollUnlocked'));
                    window.dispatchEvent(
                        new Event('pendingActions:forceClose'),
                    );
                } catch {
                    /* noop */
                }
                try {
                    window.dispatchEvent(
                        new CustomEvent('systemMessage', {
                            detail: {
                                text: 'Consulta concluída.',
                                type: 'success',
                            },
                        }),
                    );
                } catch {
                    /* noop */
                }
                setTimeout(() => {
                    try {
                        window.dispatchEvent(
                            new Event('ensureScrollUnlocked'),
                        );
                    } catch {
                        /* noop */
                    }
                }, 120);
            }, 120);
        } catch (e) {
            const msg =
                e instanceof Error ? e.message : 'Falha ao concluir';
            try {
                window.dispatchEvent(
                    new CustomEvent('systemMessage', {
                        detail: { text: msg, type: 'error' },
                    }),
                );
                window.dispatchEvent(new Event('ensureScrollUnlocked'));
                debugLog('PendingActions: systemMessage error (no-record)', {
                    msg,
                });
            } catch {
                /* noop */
            }
            setErrorText(msg);
        } finally {
            setBusy(null);
            setClosing(false);
            debugLog('PendingActions: doFinalizeWithoutRecord finally');
        }
    }

    return (
        <AppModal
            open={open}
            onClose={onClose}
            unmountOnClose
            closeOnEnter={false}
            disableBackdropClose={true}
            disableEscapeKeyDown={true}
        >
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    minWidth: 280,
                }}
                data-modal='PendingActions'
                data-appt-id={appt?.id ?? undefined}
                data-instance={instanceId}
            >
                {/* Cabeçalho: nome do cliente em destaque + horário */}
                <div>
                    <h3
                        style={{
                            margin: 0,
                            fontSize: 20,
                            fontWeight: 700,
                            color: '#1f2937',
                            lineHeight: 1.2,
                        }}
                    >
                        {clientName}
                    </h3>
                    <p
                        style={{
                            margin: '4px 0 0',
                            fontSize: 14,
                            color: '#6b7280',
                        }}
                    >
                        {timeRange}
                    </p>
                    {realClosedLine && (
                        <p
                            style={{
                                margin: '4px 0 0',
                                fontSize: 13,
                                color: 'var(--color-success)',
                                fontWeight: 600,
                            }}
                        >
                            {realClosedLine}
                        </p>
                    )}
                </div>

                {/* Aviso cobrança paga */}
                {hasPaidCharge && (
                    <div
                        style={{
                            padding: '10px 12px',
                            borderRadius: 10,
                            background: '#fff7ed',
                            border: '1px solid #fdba74',
                            color: '#9a3412',
                            fontSize: 13,
                            lineHeight: 1.35,
                            fontWeight: 600,
                        }}
                        role='status'
                    >
                        Aviso: esta consulta ja possui cobranca ou anotacao marcada como paga. Se cancelar, revise depois a cobranca para manter o registro consistente.
                    </div>
                )}

                {/* Erro inline */}
                {errorText && (
                    <div
                        style={{
                            color: 'var(--color-canceled)',
                            fontSize: 13,
                            lineHeight: 1.2,
                        }}
                        role='alert'
                    >
                        {errorText}
                    </div>
                )}

                {/* Dois grupos lado a lado: Concluir | Cancelar */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 16,
                    }}
                >
                    {/* Esquerda: Concluir Consulta */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                        }}
                    >
                        <p
                            style={{
                                margin: 0,
                                fontWeight: 700,
                                fontSize: 12,
                                color: '#1f2937',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                            }}
                        >
                            Concluir Consulta
                        </p>
                        <button
                            onClick={doFinalize}
                            disabled={finalizeDisabled}
                            className={`ui-btn ${
                                finalizeTimeLock
                                    ? 'ui-btn--disabled'
                                    : 'ui-btn--secondary'
                            }`}
                            style={{
                                ...actionBtnBaseStyle,
                                ...(finalizeDisabled
                                    ? actionBtnDisabledStyle
                                    : actionBtnSecondaryStyle),
                                width: '100%',
                            }}
                            title={
                                finalizeTimeLock
                                    ? 'Aguardando início para permitir avançar'
                                    : 'Registrar dados financeiros e concluir'
                            }
                        >
                            {busy === 'finalize'
                                ? 'Abrindo…'
                                : finalizeTimeLock
                                  ? 'Aguardando início'
                                  : 'Com Registro'}
                        </button>
                        <button
                            onClick={doFinalizeWithoutRecord}
                            disabled={finalizeDisabled}
                            className={`ui-btn ${
                                finalizeTimeLock
                                    ? 'ui-btn--disabled'
                                    : 'ui-btn--secondary'
                            }`}
                            style={{
                                ...actionBtnBaseStyle,
                                ...(finalizeDisabled
                                    ? actionBtnDisabledStyle
                                    : actionBtnSecondaryStyle),
                                width: '100%',
                            }}
                            title={
                                finalizeTimeLock
                                    ? 'Aguardando início para permitir avançar'
                                    : 'Concluir sem registrar dados financeiros'
                            }
                        >
                            {busy === 'finalize-no-record'
                                ? 'Concluindo…'
                                : finalizeTimeLock
                                  ? 'Aguardando início'
                                  : 'Sem Registro'}
                        </button>
                    </div>

                    {/* Direita: Cancelar Consulta */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            paddingLeft: 16,
                            borderLeft: '1px solid var(--color-border)',
                        }}
                    >
                        <p
                            style={{
                                margin: 0,
                                fontWeight: 700,
                                fontSize: 12,
                                color: '#1f2937',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                            }}
                        >
                            Cancelar Consulta
                        </p>
                        <button
                            onClick={doCancel}
                            disabled={cancelDisabled}
                            className='ui-btn ui-btn--danger'
                            style={{
                                ...actionBtnBaseStyle,
                                ...(cancelDisabled
                                    ? actionBtnDisabledStyle
                                    : actionBtnDangerStyle),
                                width: '100%',
                            }}
                            title={
                                hasPaidCharge
                                    ? 'Cancelar compromisso com cobrança paga associada'
                                    : 'Cancelar compromisso'
                            }
                        >
                            {busy === 'cancel' ? 'Cancelando…' : 'Cancelar'}
                        </button>
                    </div>
                </div>
            </div>
        </AppModal>
    );
}
