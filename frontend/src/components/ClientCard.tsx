// frontend/src/components/ClientCard.tsx
import React from 'react';
import { focusClientCard } from '../utils/focusClientCard';
import styles from '../styles/components/ClientCard.module.css';
import {
    FaEye,
    FaWhatsapp,
    FaEnvelope,
    FaCalendarAlt,
    FaPlus,
} from 'react-icons/fa';
import { getMaxScheduledPerClient } from '../config/limits';
import { API_BASE } from '../config/api';
import type { Appointment } from '../hooks/useAppointments';
import QuickScheduleModal from './QuickScheduleModal';
import type { ClientBasic } from '../types/ClientBasic';
import { formatPhone } from '../utils/formatPhone';
import { FaEdit } from 'react-icons/fa';
import '../styles/palette.css';
import { parseDOB, calcAge } from '../utils/dateOfBirth';
import MonthlyAgendaModal from './MonthlyAgendaModal';
import WeeklyAgendaModal from './WeeklyAgendaModal';
import { useClientCardStyle } from './clientCard/useClientCardStyle';
import { useOngoingSnapshot } from '../hooks/useOngoingSnapshot';
import { track } from '../utils/telemetry';
import PendingActionsModal from './PendingActionsModal';
import { findFirstPendingForClient } from '../services/pending';
import type { SharedAppointmentLike } from './shared/AppointmentCard';
import FinalizeButton from './clientCard/FinalizeButton';
import FutureAppointmentsList from './clientCard/FutureAppointmentsList';
import { useHysteresisBoolean } from '../hooks/useHysteresisBoolean';
import { useAppointmentCardState } from '../hooks/useAppointmentCardState.ts';
import { useFinalizeAppointment } from '../hooks/useFinalizeAppointment';
import { useOngoingLatch, readOngoingLatch } from '../hooks/useOngoingLatch';
import { useOngoingSweep } from '../hooks/useOngoingSweep';
import { useVisibilityResumeGrace } from '../hooks/useVisibilityResumeGrace';
// Inline editor desativado temporariamente para isolar atraso no botão
// import InlineAppointmentEditor from './InlineAppointmentEditor';

interface ClientCardProps {
    client: ClientBasic;
    onView: (client: ClientBasic) => void;
    selected?: boolean;
    onSelect?: () => void;
}

export default function ClientCard({
    client,
    onView,
    selected,
    onSelect,
}: ClientCardProps) {
    // Feature flag: disable per-client ongoing probe unless explicitly enabled (reduces debug traffic)
    const ENABLE_ONGOING_PROBE =
        (import.meta as ImportMeta).env.VITE_ENABLE_ONGOING_PROBE === 'true';
    const [showMonthly, setShowMonthly] = React.useState(false);
    const [showWeekly, setShowWeekly] = React.useState(false);
    const [showQuick, setShowQuick] = React.useState(false);
    const [showPendingActions, setShowPendingActions] = React.useState(false);
    const [pendingAppt, setPendingAppt] =
        React.useState<SharedAppointmentLike | null>(null);
    const [editingAppt, setEditingAppt] = React.useState<Appointment | null>(
        null,
    );
    const [futureAppointments, setFutureAppointments] = React.useState<
        Appointment[]
    >([]);
    const [loadingFuture, setLoadingFuture] = React.useState(false);
    const [pressed, setPressed] = React.useState(false);
    const { finishing, finalize } = useFinalizeAppointment(client.id);
    // Suprimir visual de "em andamento" por alguns segundos após finalizar/cancelar
    const [suppressOngoingUntil, setSuppressOngoingUntil] = React.useState(0);
    // Simplificado: usar hora local, mas com tick para refletir mudanças de estado (scheduled→ongoing) sem interação do usuário
    function useNowTick(intervalMs: number) {
        const [now, setNow] = React.useState<Date>(() => new Date());
        React.useEffect(() => {
            // Alinha o primeiro tick ao próximo múltiplo do intervalo para suavizar transições
            const firstDelay = (() => {
                const d = new Date();
                const ms = d.getMilliseconds() + d.getSeconds() * 1000;
                const rem = intervalMs - (ms % intervalMs);
                return Math.max(250, Math.min(rem, intervalMs));
            })();
            let t1: number | null = null;
            let t2: number | null = null;
            t1 = window.setTimeout(() => {
                setNow(new Date());
                t2 = window.setInterval(
                    () => setNow(new Date()),
                    intervalMs,
                ) as unknown as number;
            }, firstDelay) as unknown as number;
            return () => {
                if (t1 != null) window.clearTimeout(t1 as unknown as number);
                if (t2 != null) window.clearInterval(t2 as unknown as number);
            };
        }, [intervalMs]);
        return now;
    }
    const now = useNowTick(5000);
    const resumeGrace = useVisibilityResumeGrace(30000);
    // Global ongoing sweep: one request for all clients
    const sweepByClient = useOngoingSweep(now, 60_000);
    // start derivado como Date não é necessário; mantemos ISO para o snapshot
    // end derivado não é necessário para estilização; snapshot usa ISO strings
    // Idade calculada uma vez (se data válida) para exibir em linha própria
    const ageYears = React.useMemo(() => {
        if (!client.date_of_birth) return null;
        const parsed = parseDOB(client.date_of_birth);
        if (!parsed) return null;
        return parsed.age != null
            ? parsed.age
            : calcAge(parsed.year, parsed.month, parsed.day);
    }, [client.date_of_birth]);
    const isScheduled = client.next_appointment_status === 'scheduled';
    // Base: informações vindas do servidor (se disponíveis)
    const startISO = client.next_appointment_start_at ?? null;
    const endISO = client.next_appointment_end_at ?? null;
    // Snapshot: mantém o estilo de atendimento ativo durante quedas breves do backend
    const { snapshot } = useOngoingSnapshot({
        clientId: client.id,
        startAt: startISO,
        endAt: endISO,
        serverIsScheduled: isScheduled,
        now,
        graceMs: 0, // alinhar com Monthly/AppointmentCard: sem tolerância extra
        useSnapshotWhenServerNotScheduled: false, // após finalizar, não manter estilo via snapshot
    });
    // Fallback: se o servidor não populou o próximo agendamento em andamento, buscamos um que contenha "agora"
    const [overrideOngoing, setOverrideOngoing] =
        React.useState<Appointment | null>(null);
    React.useEffect(() => {
        let cancelled = false;
        if (!ENABLE_ONGOING_PROBE) {
            // Use global sweep result if available
            const ap = sweepByClient.get(client.id) || null;
            setOverrideOngoing(ap);
            return () => {
                cancelled = true;
            };
        }
        async function probeOngoing() {
            if (isScheduled) {
                setOverrideOngoing(null);
                return;
            }
            try {
                const token = localStorage.getItem('accessToken') || '';
                if (!token) return;
                // Usa uma janela pequena ao redor de "agora" para capturar bordas start==now
                const probeNow = now.getTime();
                const start = new Date(probeNow - 30 * 1000);
                const end = new Date(probeNow + 30 * 1000);
                const url = `${API_BASE}/agenda/appointments/?client=${
                    client.id
                }&status=scheduled&start=${encodeURIComponent(
                    start.toISOString(),
                )}&end=${encodeURIComponent(
                    end.toISOString(),
                )}&ts=${Date.now()}`;
                const ac = new AbortController();
                const r = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: 'no-store',
                    signal: ac.signal,
                });
                const data = (await r.json()) as Appointment[];
                if (!cancelled) {
                    if (!Array.isArray(data) || !data.length) {
                        setOverrideOngoing(null);
                    } else {
                        // Só considera override quando já estiver dentro da janela [start,end)
                        const nowMs = now.getTime();
                        const inWin = data.find(ap => {
                            const s = new Date(ap.start_at).getTime();
                            const e = new Date(ap.end_at).getTime();
                            return (
                                isFinite(s) &&
                                isFinite(e) &&
                                s <= nowMs &&
                                nowMs < e
                            );
                        });
                        setOverrideOngoing(inWin ?? null);
                    }
                }
                return () => ac.abort();
            } catch {
                if (!cancelled) setOverrideOngoing(null);
            }
        }
        const cleanup = probeOngoing();
        return () => {
            cancelled = true;
            try {
                const fn = cleanup as unknown;
                if (typeof fn === 'function') (fn as () => void)();
            } catch {
                /* noop */
            }
        };
    }, [client.id, isScheduled, now, ENABLE_ONGOING_PROBE, sweepByClient]);

    // Latch: mantém estado "em andamento" persistente até finalizar/alterar
    const {
        latched,
        setLatched,
        clear: clearLatch,
    } = useOngoingLatch(client.id);

    // Preferir dados confiáveis do servidor/override; snapshot apenas como último recurso
    const baseDisplayStartISO =
        startISO ?? overrideOngoing?.start_at ?? snapshot?.startAt ?? null;
    const baseDisplayEndISO =
        endISO ?? overrideOngoing?.end_at ?? snapshot?.endAt ?? null;
    const baseEffectiveApptId =
        client.next_appointment_id ?? overrideOngoing?.id ?? null;

    // Quando tivermos uma janela confiável e status scheduled, usamos o hook compartilhado
    const windowFromServer = !!(isScheduled && startISO && endISO);
    const windowFromOverride = React.useMemo(() => {
        if (!overrideOngoing) return false;
        const s = new Date(overrideOngoing.start_at).getTime();
        const e = new Date(overrideOngoing.end_at).getTime();
        const t = now.getTime();
        return isFinite(s) && isFinite(e) && s <= t && t < e;
    }, [overrideOngoing, now]);
    const hasTrustedWindow = windowFromServer || windowFromOverride;
    const trustedStartISO = windowFromServer
        ? startISO
        : windowFromOverride
        ? overrideOngoing?.start_at ?? null
        : null;
    const trustedEndISO = windowFromServer
        ? endISO
        : windowFromOverride
        ? overrideOngoing?.end_at ?? null
        : null;
    // Preferir latch para exibição/ID se corresponder ao agendamento vigente
    const effectiveApptId = React.useMemo(() => {
        if (baseEffectiveApptId != null) return baseEffectiveApptId;
        return latched?.id ?? null;
    }, [baseEffectiveApptId, latched?.id]);
    // Consider latch valid only until a small grace after end
    const latchedValid = React.useMemo(() => {
        if (!latched) return false;
        const endMs = new Date(latched.endAt).getTime();
        if (!isFinite(endMs)) return false;
        const nowMs = now.getTime();
        const GRACE_MS = 90 * 1000; // 90s grace to cover tick skew
        return nowMs < endMs + GRACE_MS;
    }, [latched, now]);
    const displayStartISO = React.useMemo(() => {
        if (latched && latchedValid && effectiveApptId === latched.id)
            return latched.startAt;
        return baseDisplayStartISO;
    }, [latched, latchedValid, effectiveApptId, baseDisplayStartISO]);
    const displayEndISO = React.useMemo(() => {
        if (latched && latchedValid && effectiveApptId === latched.id)
            return latched.endAt;
        return baseDisplayEndISO;
    }, [latched, latchedValid, effectiveApptId, baseDisplayEndISO]);
    const apptLike = React.useMemo(
        () => ({
            start_at: displayStartISO || new Date(0).toISOString(),
            end_at: displayEndISO || new Date(0).toISOString(),
            status: 'scheduled' as const,
        }),
        [displayStartISO, displayEndISO],
    );
    const apptState = useAppointmentCardState(apptLike, now);
    const isOngoingRaw = React.useMemo(() => {
        const t = now.getTime();
        if (suppressOngoingUntil > t) return false;
        // Prefer latch (mantém visual até finalizar), senão confia na janela/estado compartilhado
        if (
            latchedValid &&
            latched &&
            (!baseEffectiveApptId || latched.id === effectiveApptId)
        )
            return true;
        return hasTrustedWindow ? apptState.isOngoing : false;
    }, [
        hasTrustedWindow,
        apptState,
        now,
        suppressOngoingUntil,
        latched,
        latchedValid,
        baseEffectiveApptId,
        effectiveApptId,
    ]);

    // Auto-clear latch some time after the end to avoid sticky ongoing if finalize didn't fire
    React.useEffect(() => {
        if (!latched) return;
        const endMs = new Date(latched.endAt).getTime();
        if (!isFinite(endMs)) return;
        const nowMs = now.getTime();
        const CLEAR_GRACE_MS = 2 * 60 * 1000; // 2 minutes
        if (!resumeGrace && nowMs >= endMs + CLEAR_GRACE_MS) {
            clearLatch();
            return;
        }
        const delay = endMs + CLEAR_GRACE_MS - nowMs;
        const t = window.setTimeout(() => {
            try {
                if (!resumeGrace) clearLatch();
            } catch {
                /* noop */
            }
        }, Math.max(0, delay));
        return () => window.clearTimeout(t);
    }, [latched, now, clearLatch, resumeGrace]);

    // On resume (visibility/pageshow), refresh local latched state from storage in case iOS flushed memory
    React.useEffect(() => {
        function refreshFromStorage() {
            try {
                const snap = readOngoingLatch(client.id);
                if (snap) {
                    setLatched({
                        id: snap.id,
                        startAt: snap.startAt,
                        endAt: snap.endAt,
                    });
                }
            } catch {
                /* noop */
            }
        }
        const onVisibility = () => refreshFromStorage();
        const onPageShow = () => refreshFromStorage();
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('pageshow', onPageShow as EventListener);
        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('pageshow', onPageShow as EventListener);
        };
    }, [client.id, setLatched]);

    // Aplicar histerese visual: aguarda 250ms para entrar em ongoing; saída é imediata
    const isOngoing = useHysteresisBoolean(isOngoingRaw, {
        enterDelayMs: 500,
        exitDelayMs: 0,
    });

    // Telemetry: entering ongoing window
    const prevOngoingRef = React.useRef(false);
    React.useEffect(() => {
        if (
            !prevOngoingRef.current &&
            isOngoing &&
            effectiveApptId &&
            displayStartISO
        ) {
            track({
                type: 'appointment_entered_ongoing',
                payload: {
                    id: effectiveApptId,
                    start_at: displayStartISO,
                    client_id: client.id,
                },
            });
            // Latch ao entrar em andamento via janela confiável
            if (hasTrustedWindow && trustedStartISO && trustedEndISO) {
                setLatched({
                    id: effectiveApptId,
                    startAt: trustedStartISO,
                    endAt: trustedEndISO,
                });
            }
            // Ao entrar em andamento, rolar até o cartão do cliente
            try {
                focusClientCard(client.id);
            } catch {
                /* noop */
            }
        }
        prevOngoingRef.current = isOngoing;
    }, [
        isOngoing,
        effectiveApptId,
        displayStartISO,
        client.id,
        hasTrustedWindow,
        trustedStartISO,
        trustedEndISO,
        setLatched,
    ]);

    // Derived pending: when the next appointment from server is scheduled but already ended in the past
    const isPending = React.useMemo(() => {
        if (!isScheduled) return false;
        const sISO = client.next_appointment_start_at;
        const eISO = client.next_appointment_end_at;
        if (!sISO || !eISO) return false;
        const e = new Date(eISO).getTime();
        return e <= now.getTime();
    }, [
        isScheduled,
        client.next_appointment_start_at,
        client.next_appointment_end_at,
        now,
    ]);

    // Helper para abrir o modal de pendência com os dados do próximo compromisso pendente
    const openPendingActions = React.useCallback(() => {
        const sISO = client.next_appointment_start_at;
        const eISO = client.next_appointment_end_at;
        const id = client.next_appointment_id ?? undefined;
        if (!sISO || !eISO || !id) {
            // Fallback: mensagem caso dados estejam inconsistentes
            try {
                window.dispatchEvent(
                    new CustomEvent('systemMessage', {
                        detail: {
                            text: 'Há uma pendência, mas não foi possível carregar os detalhes. Atualize a página.',
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
        setPendingAppt(appt);
        setShowPendingActions(true);
    }, [client]);

    // Verifica no servidor se existe ALGUM compromisso agendado que já terminou (pendente)
    const detectAnyPendingFromServer = React.useCallback(
        () => findFirstPendingForClient(client.id, now),
        [client.id, now],
    );

    // Fluxo: tenta abrir pendência; se não houver, cai para QuickSchedule
    const tryOpenPendingElseQuick = React.useCallback(async () => {
        if (isPending) {
            openPendingActions();
            return;
        }
        const appt = await detectAnyPendingFromServer();
        if (appt) {
            setPendingAppt(appt);
            setShowPendingActions(true);
            return;
        }
        setEditingAppt(null);
        setShowQuick(true);
    }, [isPending, openPendingActions, detectAnyPendingFromServer]);

    const hasAgendaLine = isScheduled || isOngoing; // mantém a linha visível durante a janela em andamento
    // Estilos centralizados via hook: mantém regra de cartão branco durante atendimento
    const {
        containerStyle,
        labelColor,
        iconColor,
        valueColor,
        separatorColor,
        separatorOpacity,
    } = useClientCardStyle({ isOngoing, selected, pressed, isScheduled });
    const cardRef = React.useRef<HTMLDivElement | null>(null);

    // Finalização com encapsulamento via hook
    const finalizeEarlyAware = React.useCallback(async () => {
        const apptId = effectiveApptId;
        if (!apptId) return;
        const ok = await finalize(apptId, {
            preferEarly: isOngoing,
            openPendingAfter: async () => {
                const appt = await detectAnyPendingFromServer();
                if (appt) {
                    setPendingAppt(appt);
                    setShowPendingActions(true);
                }
            },
        });
        if (ok) {
            // Otimismo local: remove override e suprime estilo ongoing por alguns segundos
            setOverrideOngoing(null);
            clearLatch();
            setSuppressOngoingUntil(now.getTime() + 8000);
        }
    }, [
        effectiveApptId,
        isOngoing,
        finalize,
        detectAnyPendingFromServer,
        now,
        clearLatch,
    ]);
    // Fechar modo edição ao clicar fora do card
    // Efeito de clique fora removido enquanto editor inline está desativado
    // Borda e fundo já definidos no hook (containerStyle)
    // title display moved into the agenda section below when scheduled
    // Flash visual ao focar/entrar em andamento removido — mantemos apenas seleção + scroll
    React.useEffect(() => {
        let cancelled = false;
        const cleanupTimers: number[] = [];
        // Cancela auto-scroll se usuário interagir manualmente após o trigger
        function cancelByUser() {
            cancelled = true;
        }
        window.addEventListener('touchstart', cancelByUser, { passive: true });
        window.addEventListener('wheel', cancelByUser, { passive: true });

        function ensureVisible(attempt: number) {
            if (cancelled) return;
            const el = cardRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const vh =
                window.innerHeight || document.documentElement.clientHeight;
            const overlapTop = Math.max(
                0,
                Math.min(rect.bottom, vh) - Math.max(rect.top, 0),
            );
            const ratio = overlapTop / rect.height;
            // Se menos de 70% visível ou topo muito acima (< -32) ou bottom cortado > 32px, ajusta
            const needsScroll =
                ratio < 0.7 || rect.top < 8 || rect.bottom > vh - 8;
            if (needsScroll) {
                try {
                    // Calcula scroll target centralizado mas com leve offset para deixar título visível
                    const currentY = window.scrollY || window.pageYOffset;
                    const offset = 110; // maior offset para manter cabeçalho/label totalmente visível
                    const targetTop = Math.max(0, rect.top + currentY - offset);
                    window.scrollTo({ top: targetTop, behavior: 'smooth' });
                } catch {
                    try {
                        el.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                        });
                    } catch {
                        /* noop */
                    }
                }
            }
            // Re-tenta se ainda houver mudanças de layout (ex: futuros compromissos carregando)
            if (attempt < 4) {
                const t = window.setTimeout(
                    () => ensureVisible(attempt + 1),
                    [0, 150, 350, 700, 1200][attempt],
                );
                cleanupTimers.push(t as unknown as number);
            }
        }

        function onScrollEv(e: Event) {
            const det = (e as CustomEvent).detail;
            if (det && det.clientId === client.id) {
                // Garante seleção do cartão ao receber evento de foco/scroll
                try {
                    onSelect?.();
                } catch {
                    /* noop */
                }
                // agenda verificação assíncrona depois do repaint para pegar altura final inicial
                requestAnimationFrame(() => ensureVisible(0));
            }
        }
        window.addEventListener(
            'scrollToClientCard',
            onScrollEv as EventListener,
        );
        return () => {
            window.removeEventListener(
                'scrollToClientCard',
                onScrollEv as EventListener,
            );
            window.removeEventListener('touchstart', cancelByUser);
            window.removeEventListener('wheel', cancelByUser);
        };
    }, [client.id, onSelect]);

    React.useEffect(() => {
        if (!isScheduled) {
            setFutureAppointments([]);
            return;
        }
        function fetchFuture() {
            const token = localStorage.getItem('accessToken');
            if (!token) return;
            const startRef = client.next_appointment_start_at;
            if (!startRef) return;
            setLoadingFuture(true);
            const dynLimit = getMaxScheduledPerClient();
            const overfetchLimit = dynLimit + 5;
            const url = `${API_BASE}/agenda/appointments/?start=${encodeURIComponent(
                startRef,
            )}&limit=${overfetchLimit}&ordering=start_at&client=${client.id}`;
            fetch(url, { headers: { Authorization: `Bearer ${token}` } })
                .then(r => (r.ok ? r.json() : []))
                .then((data: Appointment[]) => {
                    const list = (Array.isArray(data) ? data : [])
                        .filter(a => a.status === 'scheduled')
                        .filter(a => a.id !== client.next_appointment_id);
                    const total = (isScheduled ? 1 : 0) + list.length;
                    if (total > dynLimit) {
                        try {
                            window.dispatchEvent(
                                new CustomEvent('systemMessage', {
                                    detail: {
                                        text: `Excedido limite de ${dynLimit} compromissos (total atual: ${total}). Ajuste/cancelamento necessário.`,
                                        type: 'warning',
                                    },
                                }),
                            );
                        } catch {
                            /* noop */
                        }
                    }
                    setFutureAppointments(list);
                })
                .catch(() => setFutureAppointments([]))
                .finally(() => setLoadingFuture(false));
        }
        fetchFuture();
        const listener = () => {
            // Mudanças de compromissos: limpar overrides e suprimir estilo se estava em andamento
            setOverrideOngoing(null);
            clearLatch();
            fetchFuture();
        };
        window.addEventListener(
            'appointments:changed',
            listener as EventListener,
        );
        return () => {
            window.removeEventListener(
                'appointments:changed',
                listener as EventListener,
            );
        };
    }, [
        client.id,
        isScheduled,
        client.next_appointment_start_at,
        client.next_appointment_id,
        clearLatch,
    ]);

    // Clear ongoing visual immediately when a targeted event is dispatched (same-tab UX)
    React.useEffect(() => {
        function onClearOngoing(e: Event) {
            const ce = e as CustomEvent<{ clientId?: number }>;
            const cid = ce?.detail?.clientId;
            if (cid && cid === client.id) {
                setOverrideOngoing(null);
                clearLatch();
                setSuppressOngoingUntil(Date.now() + 5000);
            }
        }
        window.addEventListener(
            'client:clearOngoing',
            onClearOngoing as EventListener,
        );
        return () => {
            window.removeEventListener(
                'client:clearOngoing',
                onClearOngoing as EventListener,
            );
        };
    }, [client.id, clearLatch]);

    const cardClassNames = [styles.card, selected ? styles.cardSelected : '']
        .filter(Boolean)
        .join(' ');

    return (
        <div
            ref={cardRef}
            className={cardClassNames}
            style={containerStyle}
            onClick={() => onSelect?.()}
            onMouseDown={() => setPressed(true)}
            onMouseUp={() => setPressed(false)}
            onMouseLeave={() => setPressed(false)}
            onTouchStart={() => setPressed(true)}
            onTouchEnd={() => setPressed(false)}
        >
            {/* Removida barra lateral colorida: foco no esquema de dois tons (borda + fundo) */}
            <div className={styles.infoRow}>
                <div className={styles.rowBaseline}>
                    <span
                        className={styles.label}
                        style={{
                            color: labelColor,
                            fontWeight: 'bold',
                            minWidth: 56,
                        }}
                    >
                        Nome:
                    </span>
                    <span
                        className={styles.value}
                        style={{ color: valueColor, lineHeight: 1.3 }}
                    >
                        {client.first_name} {client.last_name}
                    </span>
                </div>
                <button
                    className={styles.iconButton}
                    title='Visualizar detalhes'
                    onClick={e => {
                        e.stopPropagation();
                        onView(client);
                    }}
                >
                    <FaEye color={iconColor} />
                </button>
            </div>
            {ageYears !== null && (
                <div className={styles.infoRow}>
                    <span
                        className={styles.label}
                        style={{ color: labelColor, fontWeight: 'bold' }}
                    >
                        Idade:
                    </span>
                    <span
                        className={styles.value}
                        style={{ color: valueColor }}
                    >
                        {ageYears} anos
                    </span>
                </div>
            )}

            <div className={styles.infoRow}>
                <span
                    className={styles.label}
                    style={{ color: labelColor, fontWeight: 'bold' }}
                >
                    Tel:
                </span>
                <span className={styles.value} style={{ color: valueColor }}>
                    {formatPhone(client.phone)}
                </span>
                <a
                    className={styles.iconButton}
                    title='WhatsApp'
                    href={`https://wa.me/${
                        client.phone ? client.phone.replace(/\D/g, '') : ''
                    }`}
                    target='_blank'
                    rel='noopener noreferrer'
                    onClick={e => e.stopPropagation()}
                >
                    <FaWhatsapp color={iconColor} />
                </a>
            </div>
            {/* Endereço - inclui número se houver */}
            {client.address && (
                <div className={styles.infoRow}>
                    <span
                        className={styles.label}
                        style={{ color: labelColor, fontWeight: 'bold' }}
                    >
                        Rua:
                    </span>
                    <span
                        className={styles.value}
                        style={{ color: valueColor, lineHeight: 1.3 }}
                    >
                        {client.address}
                        {client.address_number && (
                            <span style={{ marginLeft: 4 }}>
                                Nº {client.address_number}
                            </span>
                        )}
                    </span>
                </div>
            )}
            {client.email && client.email.trim() && (
                <div className={styles.infoRow}>
                    <span
                        className={styles.label}
                        style={{
                            color: labelColor,
                            fontWeight: 'bold',
                        }}
                    >
                        E-mail:
                    </span>
                    <span
                        className={styles.value}
                        style={{ color: valueColor }}
                    >
                        {client.email}
                    </span>
                    <a
                        className={styles.iconButton}
                        title='E-mail'
                        href={`mailto:${client.email}`}
                        target='_blank'
                        rel='noopener noreferrer'
                        onClick={e => e.stopPropagation()}
                    >
                        <FaEnvelope color={iconColor} />
                    </a>
                </div>
            )}

            {/* Separator between personal data and agenda info (increased spacing) */}
            {hasAgendaLine && (
                <div
                    aria-hidden
                    style={{
                        height: 1,
                        background: separatorColor,
                        opacity: separatorOpacity,
                        margin: '12px 0 12px',
                        borderRadius: 1,
                    }}
                />
            )}

            {/* Agenda section below E-mail. Quando agendado pelo servidor, mostra detalhes completos. */}
            {isScheduled && (
                <>
                    <div className={styles.infoRow}>
                        <span
                            className={styles.label}
                            style={{ color: labelColor, fontWeight: 'bold' }}
                        >
                            Agenda (tipo):
                        </span>
                        <span
                            className={styles.value}
                            style={{ color: valueColor }}
                        >
                            {client.next_appointment_title || 'Consulta'}
                        </span>
                        {(() => {
                            const dynLimit = getMaxScheduledPerClient();
                            const totalScheduled =
                                (isScheduled ? 1 : 0) +
                                futureAppointments.length;
                            const limitReached = totalScheduled >= dynLimit;
                            const title = isPending
                                ? 'Há um compromisso pendente. Finalize antes de criar outro.'
                                : isOngoing
                                ? 'Em andamento: finalize para criar um novo.'
                                : limitReached
                                ? `Limite de ${dynLimit} compromissos (atual: ${totalScheduled})`
                                : 'Novo agendamento';
                            return (
                                <button
                                    className={styles.iconButton}
                                    title={title}
                                    disabled={limitReached || isOngoing}
                                    style={
                                        limitReached || isOngoing
                                            ? {
                                                  opacity: 0.45,
                                                  cursor: 'not-allowed',
                                              }
                                            : undefined
                                    }
                                    onClick={e => {
                                        e.stopPropagation();
                                        if (isOngoing) {
                                            try {
                                                window.dispatchEvent(
                                                    new CustomEvent(
                                                        'systemMessage',
                                                        {
                                                            detail: {
                                                                text: 'Finalize o atendimento em andamento antes de criar outro.',
                                                                type: 'warning',
                                                            },
                                                        },
                                                    ),
                                                );
                                            } catch {
                                                /* noop */
                                            }
                                            return;
                                        }
                                        if (isPending) {
                                            openPendingActions();
                                            return;
                                        }
                                        if (limitReached) {
                                            try {
                                                window.dispatchEvent(
                                                    new CustomEvent(
                                                        'systemMessage',
                                                        {
                                                            detail: {
                                                                text: `Limite de ${dynLimit} compromissos atingido (total: ${totalScheduled})`,
                                                                type: 'warning',
                                                            },
                                                        },
                                                    ),
                                                );
                                            } catch {
                                                /* noop */
                                            }
                                            return;
                                        }
                                        // Verifica no servidor se há pendência; se não houver, abre QuickSchedule
                                        (async () => {
                                            await tryOpenPendingElseQuick();
                                        })();
                                    }}
                                >
                                    <FaPlus color={iconColor} />
                                </button>
                            );
                        })()}
                        <button
                            className={styles.iconButton}
                            title='Agenda mensal'
                            onClick={e => {
                                e.stopPropagation();
                                setShowMonthly(true);
                            }}
                        >
                            <FaCalendarAlt color={iconColor} />
                        </button>
                    </div>
                    <div className={styles.infoRow}>
                        <span
                            className={styles.label}
                            style={{
                                color: labelColor,
                                fontWeight: 'bold',
                            }}
                        >
                            Data:
                        </span>
                        <span
                            className={styles.value}
                            style={{ color: labelColor }}
                        >
                            {(() => {
                                const s = client.next_appointment_start_at
                                    ? new Date(client.next_appointment_start_at)
                                    : null;
                                const e = client.next_appointment_end_at
                                    ? new Date(client.next_appointment_end_at)
                                    : s
                                    ? new Date(s.getTime() + 60 * 60 * 1000)
                                    : null;
                                const wd = s
                                    ? s
                                          .toLocaleDateString('pt-BR', {
                                              weekday: 'short',
                                          })
                                          .replace('.', '')
                                          .replace(/\b(\w)/, c =>
                                              c.toUpperCase(),
                                          )
                                    : '--';
                                const dd = s
                                    ? String(s.getDate()).padStart(2, '0')
                                    : '--';
                                const mm = s
                                    ? String(s.getMonth() + 1).padStart(2, '0')
                                    : '--';
                                const fmt = (d: Date | null) =>
                                    d
                                        ? d.toLocaleTimeString('pt-BR', {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                          })
                                        : '--:--';
                                return `${wd} ${dd}/${mm}, ${fmt(s)} - ${fmt(
                                    e,
                                )}`;
                            })()}
                        </span>
                        {client.next_appointment_id && !isOngoing && (
                            <button
                                className={styles.iconButton}
                                title='Editar agendamento'
                                onClick={e => {
                                    e.stopPropagation();
                                    const token =
                                        localStorage.getItem('accessToken');
                                    fetch(
                                        `${API_BASE}/agenda/appointments/${client.next_appointment_id}/`,
                                        {
                                            headers: {
                                                Authorization: token
                                                    ? `Bearer ${token}`
                                                    : '',
                                            },
                                        },
                                    )
                                        .then(r => (r.ok ? r.json() : null))
                                        .then(data => {
                                            setEditingAppt(data);
                                            setShowQuick(true);
                                        })
                                        .catch(() => {
                                            setEditingAppt(null);
                                            setShowQuick(true);
                                        });
                                }}
                            >
                                <FaEdit color={iconColor} />
                            </button>
                        )}
                    </div>
                    {isOngoing && (
                        <div
                            className={styles.infoRow}
                            style={{ paddingTop: 0 }}
                        >
                            <span
                                style={{
                                    background: 'var(--color-ongoing)',
                                    color: '#fff',
                                    borderRadius: 6,
                                    padding: '2px 8px',
                                    fontWeight: 700,
                                    fontSize: 12,
                                }}
                            >
                                Em andamento
                            </span>
                        </div>
                    )}
                    {/* Linha de ações: abaixo da Data */}
                    <div className={styles.infoRow} style={{ gap: 8 }}>
                        <span
                            className={styles.label}
                            style={{ color: labelColor, fontWeight: 'bold' }}
                        >
                            Ações:
                        </span>
                        <div
                            style={{
                                display: 'flex',
                                gap: 8,
                                flexWrap: 'wrap',
                            }}
                        >
                            {isOngoing && (
                                <FinalizeButton
                                    finishing={finishing}
                                    disabled={!effectiveApptId}
                                    isEarly={isOngoing}
                                    clientId={client.id}
                                    appointmentId={effectiveApptId}
                                    onFinalize={finalizeEarlyAware}
                                />
                            )}
                            {/* Botão 'Editar' removido: editar agora via ícone na linha de Data */}
                        </div>
                    </div>
                    <div
                        className={styles.infoRow}
                        style={{ cursor: 'default' }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                flex: 1,
                            }}
                        >
                            <span
                                className={styles.label}
                                style={{
                                    color: labelColor,
                                    fontWeight: 'bold',
                                    marginBottom: 4,
                                }}
                            >
                                Observações:
                            </span>
                            <span
                                className={styles.value}
                                style={{ color: valueColor }}
                            >
                                {client.next_appointment_notes?.trim() ? (
                                    <span className={styles.notesText}>
                                        {client.next_appointment_notes.trim()}
                                    </span>
                                ) : (
                                    '—'
                                )}
                            </span>
                        </div>
                    </div>
                </>
            )}

            {/* Fallback: durante a janela em andamento (snapshot), manter a linha de Data visível */}
            {!isScheduled && isOngoing && (
                <div className={styles.infoRow}>
                    <span
                        className={styles.label}
                        style={{ color: labelColor, fontWeight: 'bold' }}
                    >
                        Data:
                    </span>
                    <span
                        className={styles.value}
                        style={{ color: labelColor }}
                    >
                        {(() => {
                            const s = displayStartISO
                                ? new Date(displayStartISO)
                                : null;
                            const e = displayEndISO
                                ? new Date(displayEndISO)
                                : null;
                            const wd = s
                                ? s
                                      .toLocaleDateString('pt-BR', {
                                          weekday: 'short',
                                      })
                                      .replace('.', '')
                                      .replace(/\b(\w)/, c => c.toUpperCase())
                                : '--';
                            const dd = s
                                ? String(s.getDate()).padStart(2, '0')
                                : '--';
                            const mm = s
                                ? String(s.getMonth() + 1).padStart(2, '0')
                                : '--';
                            const fmt = (d: Date | null) =>
                                d
                                    ? d.toLocaleTimeString('pt-BR', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                      })
                                    : '--:--';
                            return `${wd} ${dd}/${mm}, ${fmt(s)} - ${fmt(e)}`;
                        })()}
                    </span>
                </div>
            )}

            {/* Ongoing badge below the date (fallback case) */}
            {!isScheduled && isOngoing && (
                <div className={styles.infoRow} style={{ paddingTop: 0 }}>
                    <span
                        style={{
                            background: 'var(--color-ongoing)',
                            color: '#fff',
                            borderRadius: 6,
                            padding: '2px 8px',
                            fontWeight: 700,
                            fontSize: 12,
                        }}
                    >
                        Em andamento
                    </span>
                </div>
            )}

            {/* Linha de ações para fallback (somente quando em andamento) */}
            {!isScheduled && isOngoing && (
                <div className={styles.infoRow} style={{ gap: 8 }}>
                    <span
                        className={styles.label}
                        style={{ color: labelColor, fontWeight: 'bold' }}
                    >
                        Ações:
                    </span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <FinalizeButton
                            finishing={finishing}
                            disabled={!effectiveApptId}
                            isEarly={isOngoing}
                            clientId={client.id}
                            appointmentId={effectiveApptId}
                            onFinalize={finalizeEarlyAware}
                        />
                    </div>
                </div>
            )}

            {!isScheduled && !isOngoing && (
                <div className={styles.infoRow}>
                    <span
                        className={styles.label}
                        style={{ color: labelColor, fontWeight: 'bold' }}
                    >
                        Data:
                    </span>
                    <span
                        className={styles.value}
                        style={{ color: valueColor }}
                    >
                        Sem agendamento
                    </span>
                    {(() => {
                        const dynLimit = getMaxScheduledPerClient();
                        const totalScheduled =
                            (isScheduled ? 1 : 0) + futureAppointments.length;
                        const limitReached = totalScheduled >= dynLimit;
                        const title = isPending
                            ? 'Há um compromisso pendente. Finalize antes de criar outro.'
                            : limitReached
                            ? `Limite de ${dynLimit} compromissos (atual: ${totalScheduled})`
                            : 'Agendar';
                        return (
                            <>
                                <button
                                    className={styles.iconButton}
                                    title={title}
                                    disabled={limitReached}
                                    style={
                                        limitReached
                                            ? {
                                                  opacity: 0.45,
                                                  cursor: 'not-allowed',
                                              }
                                            : undefined
                                    }
                                    onClick={e => {
                                        e.stopPropagation();
                                        if (isPending) {
                                            openPendingActions();
                                            return;
                                        }
                                        if (limitReached) {
                                            try {
                                                window.dispatchEvent(
                                                    new CustomEvent(
                                                        'systemMessage',
                                                        {
                                                            detail: {
                                                                text: `Limite de ${dynLimit} compromissos atingido (total: ${totalScheduled})`,
                                                                type: 'warning',
                                                            },
                                                        },
                                                    ),
                                                );
                                            } catch {
                                                /* noop */
                                            }
                                            return;
                                        }
                                        // Verifica no servidor se há pendência; se não houver, abre QuickSchedule
                                        (async () => {
                                            await tryOpenPendingElseQuick();
                                        })();
                                    }}
                                >
                                    <FaPlus color={iconColor} />
                                </button>
                                <button
                                    className={styles.iconButton}
                                    title='Agenda mensal'
                                    onClick={e => {
                                        e.stopPropagation();
                                        setShowMonthly(true);
                                    }}
                                >
                                    <FaCalendarAlt color={iconColor} />
                                </button>
                            </>
                        );
                    })()}
                </div>
            )}

            {/* Notas do próximo agendamento removidas conforme solicitação */}

            {/* Linha inferior de atalhos substituída pela seção "Opções da agenda" acima */}

            {showMonthly && (
                <MonthlyAgendaModal
                    open={showMonthly}
                    onClose={() => {
                        setShowMonthly(false);
                        try {
                            document.body.dataset.keepScroll = '1';
                            setTimeout(() => {
                                try {
                                    delete document.body.dataset.keepScroll;
                                } catch {
                                    /* noop */
                                }
                            }, 800);
                        } catch {
                            /* noop */
                        }
                        try {
                            window.dispatchEvent(
                                new Event('ensureScrollUnlocked'),
                            );
                        } catch {
                            /* noop */
                        }
                        // Reancora a lista no cartão do cliente, reutilizando o mesmo mecanismo do filtro dinâmico
                        // e do latch de "em andamento". Fazemos após o ciclo de fechamento para garantir layout estável.
                        // Pequeno atraso para deixar o MUI desmontar e a lista assentar
                        setTimeout(() => focusClientCard(client.id), 60);
                    }}
                    client={client}
                />
            )}
            {showWeekly && (
                <WeeklyAgendaModal
                    open={showWeekly}
                    onClose={() => setShowWeekly(false)}
                />
            )}
            {showQuick && (
                <QuickScheduleModal
                    open={showQuick}
                    onClose={() => {
                        setShowQuick(false);
                        try {
                            document.body.dataset.keepScroll = '1';
                            setTimeout(() => {
                                try {
                                    delete document.body.dataset.keepScroll;
                                } catch {
                                    /* noop */
                                }
                            }, 800);
                        } catch {
                            /* noop */
                        }
                        try {
                            window.dispatchEvent(
                                new Event('ensureScrollUnlocked'),
                            );
                        } catch {
                            /* noop */
                        }
                    }}
                    client={client}
                    editAppointment={editingAppt}
                    futureAppointments={futureAppointments}
                    maxFutureAppointments={getMaxScheduledPerClient()}
                    afterPersist={() => {
                        // Atualizar clientes para refletir dados do próximo compromisso
                        window.dispatchEvent(new Event('updateClients'));
                        // Agora FECHA também em edição conforme solicitado (uniformizar experiência)
                        setShowQuick(false);
                        try {
                            document.body.dataset.keepScroll = '1';
                            setTimeout(() => {
                                try {
                                    delete document.body.dataset.keepScroll;
                                } catch {
                                    /* noop */
                                }
                            }, 800);
                        } catch {
                            /* noop */
                        }
                        try {
                            window.dispatchEvent(
                                new Event('ensureScrollUnlocked'),
                            );
                        } catch {
                            /* noop */
                        }
                    }}
                />
            )}
            {showPendingActions && pendingAppt && (
                <PendingActionsModal
                    open={showPendingActions}
                    onClose={() => setShowPendingActions(false)}
                    appt={pendingAppt}
                />
            )}
            {/* QuickScheduleModal é agora o único fluxo de agendamento (ScheduleModal legacy removido) */}
            {futureAppointments.length > 0 && (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        marginTop: 4,
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                        }}
                    >
                        <FutureAppointmentsList
                            items={futureAppointments}
                            valueColor={valueColor}
                            iconColor={iconColor}
                            labelColor={labelColor}
                            clientId={client.id}
                            onEdit={(appt: Appointment) => {
                                setEditingAppt(appt);
                                setShowQuick(true);
                            }}
                        />
                        {loadingFuture && (
                            <div style={{ fontSize: 11, color: '#6b7280' }}>
                                Carregando…
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
