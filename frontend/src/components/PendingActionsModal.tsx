import React from 'react';
import { useNavigate } from 'react-router-dom';
import AppModal from './Modal';
import { clearOngoingSnapshot } from '../hooks/useOngoingSnapshot';
import type { SharedAppointmentLike } from './shared/AppointmentCard';
import { dispatchers } from '../events/dispatchers';
import { cancelFlow } from '../services/flows/cancelFlow';
import { finalizeFlow } from '../services/flows/finalizeFlow';
import { formatTime } from '../utils/timeFormat';
import { API_BASE } from '../config/api';
import { apiFetch } from '../utils/apiFetch';
import {
    setAppointmentOverride,
    getAppointmentOverride,
    subscribeOverrides,
} from '../utils/appointments/overrides';
import { step, debugLog, isStepEnabled } from '../debug/stepper';

interface PendingActionsModalProps {
    open: boolean;
    onClose: () => void;
    appt: SharedAppointmentLike | null;
    returnContext?: unknown;
}

const labelStyle: React.CSSProperties = {
    fontSize: 14,
    color: 'var(--color-pending)',
    fontWeight: 700,
};

const valueStyle: React.CSSProperties = {
    fontSize: 14,
    color: 'var(--color-heading)',
};

type AppointmentCharge = {
    id: number;
    status: string;
    paid_at?: string | null;
    items?: Array<{
        paid?: boolean;
        paid_at?: string | null;
    }>;
};

export default function PendingActionsModal({
    open,
    onClose,
    appt,
    returnContext,
}: PendingActionsModalProps) {
    const [busy, setBusy] = React.useState<'cancel' | 'finalize' | null>(null);
    const [closing, setClosing] = React.useState(false);
    const [errorText, setErrorText] = React.useState<string | null>(null);
    const [hasPaidCharge, setHasPaidCharge] = React.useState(false);
    const [, forceRender] = React.useState(0);
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
        const unsub = subscribeOverrides(ids => {
            if (ids && !ids.includes(appt.id)) return;
            // Re-render to reflect override changes
            forceRender(t => t + 1);
            try {
                const ov = getAppointmentOverride(appt.id);
                // Auto-close when override indicates terminal status even if parent 'appt' prop still shows scheduled
                if (
                    ov &&
                    (ov.status === 'done' || ov.status === 'canceled') &&
                    open
                ) {
                    debugLog(
                        'PendingActions: auto-close via override terminal status',
                        { id: appt.id, ovStatus: ov.status },
                    );
                    // Prevent double-close loops
                    setClosing(true);
                    try {
                        onClose();
                    } catch {
                        /* noop */
                    }
                    try {
                        window.dispatchEvent(
                            new Event('pendingActions:forceClose'),
                        );
                        window.dispatchEvent(new Event('ensureScrollUnlocked'));
                    } catch {
                        /* noop */
                    }
                }
            } catch {
                /* noop */
            }
        });
        return () => {
            try {
                unsub();
            } catch {
                /* ignore unsubscribe issues */
            }
        };
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

    // If modal receives a non-scheduled appointment (e.g., canceled/done), auto-close defensively.
    React.useEffect(() => {
        if (!open || !appt) return;
        const st = (appt as SharedAppointmentLike).status as string | undefined;
        if (st && st.toLowerCase() !== 'scheduled') {
            try {
                debugLog(
                    'PendingActions: auto-close due to non-scheduled status',
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

    // Dynamic time status hooks first (can't be after early return)
    const [nowTick, setNowTick] = React.useState(() => Date.now());
    React.useEffect(() => {
        if (!open) return; // skip while closed
        const id = setInterval(() => setNowTick(Date.now()), 40000);
        return () => clearInterval(id);
    }, [open]);
    let timeStatus: {
        label: string;
        tone: 'neutral' | 'progress' | 'late' | 'future';
        detail?: string;
    } = { label: '—', tone: 'neutral' };
    if (appt) {
        const startDate = new Date(appt.start_at);
        const endDate = new Date(appt.end_at);
        const nowMs = nowTick;
        const startMs = startDate.getTime();
        const endMs = endDate.getTime();
        if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
            if (nowMs < startMs) {
                const minsTo = Math.max(
                    0,
                    Math.round((startMs - nowMs) / 60000),
                );
                timeStatus = {
                    label: 'Aguardando início',
                    tone: 'future',
                    detail: `Começa em ${minsTo} min`,
                };
            } else if (nowMs >= startMs && nowMs < endMs) {
                const elapsed = Math.round((nowMs - startMs) / 60000);
                const remaining = Math.max(
                    0,
                    Math.round((endMs - nowMs) / 60000),
                );
                timeStatus = {
                    label: 'Em andamento',
                    tone: 'progress',
                    detail: `${elapsed} min decorridos · ${remaining} min restantes`,
                };
            } else if (nowMs >= endMs) {
                const late = Math.round((nowMs - endMs) / 60000);
                timeStatus = {
                    label: 'Após horário planejado',
                    tone: 'late',
                    detail: `Terminou há ${late} min`,
                };
            }
        }
    }
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

    // Real closed timestamp (override first, fallback to backend fields if appt has them when scheduled changed externally)
    let realClosedLine: string | null = null;
    if (appt) {
        const ov = getAppointmentOverride(appt.id);
        const iso = ov?.real_closed_at;
        const reason = ov?.real_closed_reason;
        if (iso) {
            try {
                const d = new Date(iso);
                if (!Number.isNaN(d.getTime())) {
                    const hm = formatTime(d, { mode: 'local' });
                    realClosedLine = `${
                        reason === 'canceled' ? 'Cancelado' : 'Concluído'
                    } às ${hm}`;
                }
            } catch {
                /* ignore parse */
            }
        }
    }

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
                        try {
                            // Grava override local com end_at encurtado para refletir imediatamente no Card compartilhado
                            setAppointmentOverride(appt.id, {
                                status: 'canceled',
                                end_at: adjustedEndIso,
                            });
                        } catch {
                            /* noop override set */
                        }
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
        // Captura antes de qualquer operação async (props podem mudar)
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
            const res = await finalizeFlow(id);
            debugLog('PendingActions: finalizeFlow response', res);
            if (!res.ok) throw new Error(res.error || 'Falha ao finalizar');
            // Dispara eventos de atualização com pequeno backoff para evitar corrida
            try {
                // Limpa snapshot local, caso exista (garante remoção do estilo de atendimento)
                if (typeof apptClientId === 'number') {
                    clearOngoingSnapshot(apptClientId);
                }
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
            // Evento de resolução imediata para limpar pendente no ClientCard
            try {
                if (typeof apptClientId === 'number') {
                    window.dispatchEvent(
                        new CustomEvent('pending:resolved', {
                            detail: { clientId: apptClientId, status: 'done' },
                        }),
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
            // Espera curta para garantir desmontagem antes de abrir SystemMessage
            setTimeout(() => {
                try {
                    window.dispatchEvent(
                        new CustomEvent('systemMessage', {
                            detail: {
                                text: 'Atendimento marcado como concluído.',
                                type: 'success',
                            },
                        }),
                    );
                    window.dispatchEvent(new Event('ensureScrollUnlocked'));
                    debugLog(
                        'PendingActions: systemMessage success (finalize)',
                    );
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
            const msg = e instanceof Error ? e.message : 'Falha ao concluir';
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

    return (
        <AppModal
            open={open}
            onClose={onClose}
            closeOnEnter={false}
            disableBackdropClose={true}
            disableEscapeKeyDown={true}
        >
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    minWidth: 320,
                }}
                data-modal='PendingActions'
                data-appt-id={appt?.id ?? undefined}
                data-instance={instanceId}
            >
                <h3 style={{ margin: 0 }}>Consulta — Ação em Pendente</h3>
                <div style={{ display: 'grid', gap: 6 }}>
                    <div>
                        <span style={labelStyle}>Cliente: </span>
                        <span style={valueStyle}>{clientName}</span>
                    </div>
                    <div>
                        <span style={labelStyle}>Horário: </span>
                        <span style={valueStyle}>{timeRange}</span>
                    </div>
                    {realClosedLine && (
                        <div>
                            <span style={labelStyle}>Encerrado real: </span>
                            <span
                                style={{
                                    ...valueStyle,
                                    color: 'var(--color-success)',
                                }}
                            >
                                {realClosedLine}
                            </span>
                        </div>
                    )}
                    <div>
                        <span style={labelStyle}>Status tempo: </span>
                        <span
                            style={{
                                ...valueStyle,
                                color:
                                    timeStatus.tone === 'progress'
                                        ? '#2563eb'
                                        : timeStatus.tone === 'late'
                                          ? 'var(--color-canceled)'
                                          : timeStatus.tone === 'future'
                                            ? '#4b5563'
                                            : undefined,
                            }}
                        >
                            {timeStatus.label}
                            {timeStatus.detail ? ` — ${timeStatus.detail}` : ''}
                        </span>
                    </div>
                    {hasPaidCharge && (
                        <div
                            style={{
                                marginTop: 4,
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
                            Aviso: esta consulta ja possui cobranca ou anotacao marcada como paga. Se desmarcar o compromisso, revise depois a cobranca para manter o registro consistente.
                        </div>
                    )}
                </div>
                {/* Campo de motivo removido por ora. Backend ainda não coleta. */}
                <div
                    style={{
                        display: 'flex',
                        gap: 8,
                        justifyContent: 'flex-end',
                        marginTop: 4,
                    }}
                >
                    {/* Inline error when cancel/finalize fails */}
                    {errorText && (
                        <div
                            style={{
                                marginRight: 'auto',
                                color: 'var(--color-canceled)',
                                fontSize: 13,
                                lineHeight: 1.2,
                                maxWidth: 360,
                            }}
                            role='alert'
                        >
                            {errorText}
                        </div>
                    )}
                    <button
                        onClick={() => {
                            if (busy) return;
                            setClosing(true);
                            onClose();
                            // Fallback de desbloqueio de scroll
                            try {
                                window.dispatchEvent(
                                    new Event('ensureScrollUnlocked'),
                                );
                                window.dispatchEvent(
                                    new Event('pendingActions:forceClose'),
                                );
                            } catch {
                                /* noop */
                            }
                        }}
                        style={{ padding: '8px 12px', background: '#e5e7eb' }}
                        disabled={!!busy || closing}
                    >
                        Fechar
                    </button>
                    <button
                        onClick={doFinalize}
                        disabled={!!busy || closing || finalizeTimeLock}
                        style={{
                            padding: '8px 12px',
                            background: 'var(--color-done)',
                            color: '#fff',
                            fontWeight: 700,
                            opacity: finalizeTimeLock ? 0.6 : 1,
                            border: '1px solid color-mix(in oklab, var(--color-done) 60%, #0000)',
                        }}
                        title={
                            finalizeTimeLock
                                ? 'Aguardando início para permitir concluir'
                                : 'Marcar como concluído'
                        }
                    >
                        {busy === 'finalize'
                            ? 'Concluindo…'
                            : finalizeTimeLock
                              ? 'Aguardando início'
                              : 'Concluir'}
                    </button>
                    <button
                        onClick={doCancel}
                        disabled={!!busy || closing}
                        style={{
                            padding: '8px 12px',
                            background: '#ef4444',
                            color: 'var(--color-bg-section)',
                            fontWeight: 700,
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
        </AppModal>
    );
}
