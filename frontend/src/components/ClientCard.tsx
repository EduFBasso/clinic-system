// frontend/src/components/ClientCard.tsx
import React from 'react';
import { useNow } from '../hooks/useNow';
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
import ScheduleModal from './ScheduleModal';
import type { ClientBasic } from '../types/ClientBasic';
import { formatPhone } from '../utils/formatPhone';
import { FaEdit } from 'react-icons/fa';
import '../styles/palette.css';
import { parseDOB, calcAge } from '../utils/dateOfBirth';
import MonthlyAgendaModal from './MonthlyAgendaModal';
import WeeklyAgendaModal from './WeeklyPreviewModal';
import { useClientCardStyle } from './clientCard/useClientCardStyle';
import { useOngoingSnapshot } from '../hooks/useOngoingSnapshot';
import { track } from '../utils/telemetry';
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
    const [showMonthly, setShowMonthly] = React.useState(false);
    const [showWeekly, setShowWeekly] = React.useState(false);
    const [showQuick, setShowQuick] = React.useState(false);
    const [showSchedule, setShowSchedule] = React.useState(false);
    const [editingAppt, setEditingAppt] = React.useState<Appointment | null>(
        null,
    );
    // Próximos compromissos além do próximo principal
    const [futureAppointments, setFutureAppointments] = React.useState<
        Appointment[]
    >([]);
    const [loadingFuture, setLoadingFuture] = React.useState(false);
    const [pressed, setPressed] = React.useState(false);
    const [finishing, setFinishing] = React.useState(false);
    // Refresh time-based UI every 30s while visible (lightweight)
    {
        /** Botão responsivo: alterna entre 'Editar' e 'Sair' conforme estado inlineEdit */
    }
    const now = useNow(30000);
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
    const { effectiveIsOngoing, snapshot } = useOngoingSnapshot({
        clientId: client.id,
        startAt: startISO,
        endAt: endISO,
        serverIsScheduled: isScheduled,
        now,
        graceMs: 0, // alinhar com Monthly/AppointmentCard: sem tolerância extra
    });
    // Fallback: se o servidor não populou o próximo agendamento em andamento, buscamos um que contenha "agora"
    const [overrideOngoing, setOverrideOngoing] =
        React.useState<Appointment | null>(null);
    React.useEffect(() => {
        let cancelled = false;
        async function probeOngoing() {
            if (isScheduled) {
                setOverrideOngoing(null);
                return;
            }
            try {
                const token = localStorage.getItem('accessToken') || '';
                if (!token) return;
                const isoNow = new Date().toISOString();
                const url = `${API_BASE}/agenda/appointments/?client=${
                    client.id
                }&status=scheduled&start=${encodeURIComponent(
                    isoNow,
                )}&end=${encodeURIComponent(isoNow)}`;
                const r = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!r.ok) return;
                const data = (await r.json()) as Appointment[];
                if (cancelled) return;
                setOverrideOngoing(
                    Array.isArray(data) && data.length ? data[0] : null,
                );
            } catch {
                if (!cancelled) setOverrideOngoing(null);
            }
        }
        probeOngoing();
        return () => {
            cancelled = true;
        };
    }, [client.id, isScheduled, now]);

    const displayStartISO =
        startISO ?? overrideOngoing?.start_at ?? snapshot?.startAt ?? null;
    const displayEndISO =
        endISO ?? overrideOngoing?.end_at ?? snapshot?.endAt ?? null;
    const effectiveApptId =
        client.next_appointment_id ?? overrideOngoing?.id ?? null;

    const isOngoing = React.useMemo(() => {
        if (displayStartISO && displayEndISO) {
            const t = now.getTime();
            const s = new Date(displayStartISO).getTime();
            const e = new Date(displayEndISO).getTime();
            return s <= t && t < e;
        }
        return effectiveIsOngoing;
    }, [displayStartISO, displayEndISO, now, effectiveIsOngoing]);

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
        }
        prevOngoingRef.current = isOngoing;
    }, [isOngoing, effectiveApptId, displayStartISO, client.id]);

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

    async function finalizeCurrentAppointment(): Promise<void> {
        const apptId =
            client.next_appointment_id ?? overrideOngoing?.id ?? null;
        if (!apptId || finishing) return;
        track({
            type: 'appointment_finalize_clicked',
            payload: { id: apptId },
        });
        setFinishing(true);
        try {
            const token = localStorage.getItem('accessToken') || '';
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            // 1) Prefer actions if available (finalize/done)
            const candidates = [
                `${API_BASE}/agenda/appointments/${apptId}/finalize/`,
                `${API_BASE}/agenda/appointments/${apptId}/done/`,
            ];
            let ok = false;
            for (const url of candidates) {
                try {
                    const r = await fetch(url, { method: 'POST', headers });
                    if (r.ok) {
                        ok = true;
                        break;
                    }
                    if (r.status >= 500) {
                        const t = await r.text();
                        throw new Error(t || 'Erro ao finalizar');
                    }
                } catch {
                    // Tenta próximo endpoint
                }
            }
            // 2) Fallback PATCH status: done (pode ser bloqueado por validação, mas tentamos)
            if (!ok) {
                const r = await fetch(
                    `${API_BASE}/agenda/appointments/${apptId}/`,
                    {
                        method: 'PATCH',
                        headers,
                        body: JSON.stringify({ status: 'done' }),
                    },
                );
                if (!r.ok) {
                    const t = await r.text();
                    throw new Error(t || 'Não foi possível finalizar.');
                }
                ok = true;
            }

            // Feedback e atualizações globais
            try {
                window.dispatchEvent(
                    new CustomEvent('systemMessage', {
                        detail: {
                            text: 'Atendimento finalizado',
                            type: 'success',
                        },
                    }),
                );
            } catch {
                /* noop */
            }
            track({
                type: 'appointment_finalize_succeeded',
                payload: { id: apptId },
            });
            try {
                window.dispatchEvent(new Event('appointments:changed'));
                window.dispatchEvent(new Event('updateClients'));
            } catch {
                /* noop */
            }
        } catch (e) {
            const msg =
                e && typeof e === 'object' && 'message' in e
                    ? String((e as Error).message)
                    : 'Falha ao finalizar atendimento';
            if (apptId)
                track({
                    type: 'appointment_finalize_failed',
                    payload: { id: apptId, error: msg },
                });
            try {
                window.dispatchEvent(
                    new CustomEvent('systemMessage', {
                        detail: { text: msg, type: 'error' },
                    }),
                );
            } catch {
                /* noop */
            }
        } finally {
            setFinishing(false);
        }
    }
    // Fechar modo edição ao clicar fora do card
    // Efeito de clique fora removido enquanto editor inline está desativado
    // Borda e fundo já definidos no hook (containerStyle)
    // title display moved into the agenda section below when scheduled
    const [flash, setFlash] = React.useState(false);
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
                    const targetTop = rect.top + currentY - 60; // 60px de margem superior
                    window.scrollTo({ top: targetTop, behavior: 'smooth' });
                } catch {
                    try {
                        el.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
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
                setFlash(true);
                const t = setTimeout(() => setFlash(false), 2600);
                cleanupTimers.push(t as unknown as number);
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
        const listener = () => fetchFuture();
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
    ]);

    const cardClassNames = [
        styles.card,
        selected ? styles.cardSelected : '',
        flash ? styles.flashBorder : '',
    ]
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
                                : limitReached
                                ? `Limite de ${dynLimit} compromissos (atual: ${totalScheduled})`
                                : 'Novo agendamento';
                            return (
                                <button
                                    className={styles.iconButton}
                                    title={title}
                                    disabled={limitReached || isPending}
                                    style={
                                        limitReached || isPending
                                            ? {
                                                  opacity: 0.45,
                                                  cursor: 'not-allowed',
                                              }
                                            : undefined
                                    }
                                    onClick={e => {
                                        e.stopPropagation();
                                        if (isPending) {
                                            try {
                                                window.dispatchEvent(
                                                    new CustomEvent(
                                                        'systemMessage',
                                                        {
                                                            detail: {
                                                                text: 'Finalize o compromisso pendente antes de criar um novo.',
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
                                        // Abrir QuickSchedule diretamente (uniformizar comportamento)
                                        setEditingAppt(null);
                                        setShowQuick(true);
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
                                <button
                                    className={`${styles.actionButton} ${styles.actionPrimary}`}
                                    title={
                                        finishing
                                            ? 'Finalizando…'
                                            : 'Finalizar atendimento'
                                    }
                                    disabled={finishing || !effectiveApptId}
                                    onClick={e => {
                                        e.stopPropagation();
                                        let prevented = false;
                                        try {
                                            const ev = new CustomEvent(
                                                'confirmFinalizeAppointment',
                                                {
                                                    detail: {
                                                        clientId: client.id,
                                                        appointmentId:
                                                            effectiveApptId,
                                                        proceed: () =>
                                                            finalizeCurrentAppointment(),
                                                    },
                                                    cancelable: true,
                                                },
                                            );
                                            prevented =
                                                !window.dispatchEvent(ev);
                                        } catch {
                                            /* noop */
                                        }
                                        if (!prevented) {
                                            void finalizeCurrentAppointment();
                                        }
                                    }}
                                    style={{ fontWeight: 700 }}
                                >
                                    {finishing ? 'Finalizando…' : 'Finalizar'}
                                </button>
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
                        <button
                            className={`${styles.actionButton} ${styles.actionPrimary}`}
                            title={
                                finishing
                                    ? 'Finalizando…'
                                    : 'Finalizar atendimento'
                            }
                            disabled={finishing || !effectiveApptId}
                            onClick={e => {
                                e.stopPropagation();
                                let prevented = false;
                                try {
                                    const ev = new CustomEvent(
                                        'confirmFinalizeAppointment',
                                        {
                                            detail: {
                                                clientId: client.id,
                                                appointmentId: effectiveApptId,
                                                proceed: () =>
                                                    finalizeCurrentAppointment(),
                                            },
                                            cancelable: true,
                                        },
                                    );
                                    prevented = !window.dispatchEvent(ev);
                                } catch {
                                    /* noop */
                                }
                                if (!prevented)
                                    void finalizeCurrentAppointment();
                            }}
                            style={{ fontWeight: 700 }}
                        >
                            {finishing ? 'Finalizando…' : 'Finalizar'}
                        </button>
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
                                    disabled={limitReached || isPending}
                                    style={
                                        limitReached || isPending
                                            ? {
                                                  opacity: 0.45,
                                                  cursor: 'not-allowed',
                                              }
                                            : undefined
                                    }
                                    onClick={e => {
                                        e.stopPropagation();
                                        if (isPending) {
                                            try {
                                                window.dispatchEvent(
                                                    new CustomEvent(
                                                        'systemMessage',
                                                        {
                                                            detail: {
                                                                text: 'Finalize o compromisso pendente antes de criar outro.',
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
                                        // Abrir QuickSchedule diretamente em todos os dispositivos
                                        setEditingAppt(null);
                                        setShowQuick(true);
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
                    onClose={() => setShowMonthly(false)}
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
                    onClose={() => setShowQuick(false)}
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
                            window.dispatchEvent(
                                new Event('ensureScrollUnlocked'),
                            );
                        } catch {
                            /* noop */
                        }
                        setTimeout(() => {
                            try {
                                window.dispatchEvent(
                                    new CustomEvent('scrollToClientCard', {
                                        detail: { clientId: client.id },
                                    }),
                                );
                            } catch {
                                /* noop */
                            }
                        }, 50);
                    }}
                />
            )}
            {showSchedule && (
                <ScheduleModal
                    open={showSchedule}
                    onClose={() => setShowSchedule(false)}
                    client={client}
                />
            )}
            {futureAppointments.length > 0 && (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        marginTop: 4,
                    }}
                >
                    <span
                        className={styles.label}
                        style={{ color: labelColor, fontWeight: 'bold' }}
                    >
                        Próximos compromissos:
                    </span>
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                        }}
                    >
                        {futureAppointments.slice(0, 7).map(f => {
                            const s = new Date(f.start_at);
                            const e = new Date(f.end_at);
                            const wd = s
                                .toLocaleDateString('pt-BR', {
                                    weekday: 'short',
                                })
                                .replace('.', '')
                                .replace(/\b(\w)/, c => c.toUpperCase());
                            const dd = String(s.getDate()).padStart(2, '0');
                            const mm = String(s.getMonth() + 1).padStart(
                                2,
                                '0',
                            );
                            const fmt = (d: Date) =>
                                d.toLocaleTimeString('pt-BR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                });
                            const rowSelected = false; // placeholder if futuramente marcar seleção
                            // Sem exibir título aqui — foco em data/horário compactos
                            return (
                                <div
                                    key={f.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 8,
                                        padding: '6px 8px',
                                        background: rowSelected
                                            ? 'var(--color-selected-bg)'
                                            : 'var(--card-bg)',
                                        border: rowSelected
                                            ? '1px solid var(--color-selected-border)'
                                            : '1px solid var(--color-border)',
                                        borderRadius: 6,
                                        // fontSize alinhado ao restante do cartão (removido valor fixo anterior)
                                        lineHeight: 1.25,
                                    }}
                                >
                                    <div
                                        style={{
                                            flex: 1,
                                            minWidth: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            overflow: 'hidden',
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontWeight: 600,
                                                color: '#065f46',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {wd} {dd}/{mm}
                                        </span>
                                        <span
                                            style={{
                                                color: valueColor,
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                            }}
                                        >
                                            {fmt(s)} - {fmt(e)}
                                        </span>
                                    </div>
                                    <button
                                        className={styles.iconButton}
                                        title='Ver detalhes do compromisso'
                                        onClick={e => {
                                            e.stopPropagation();
                                            const token =
                                                localStorage.getItem(
                                                    'accessToken',
                                                );
                                            fetch(
                                                `${API_BASE}/agenda/appointments/${f.id}/`,
                                                {
                                                    headers: {
                                                        Authorization: token
                                                            ? `Bearer ${token}`
                                                            : '',
                                                    },
                                                },
                                            )
                                                .then(r =>
                                                    r.ok ? r.json() : null,
                                                )
                                                .then(data => {
                                                    const appt = data || f;
                                                    try {
                                                        window.dispatchEvent(
                                                            new CustomEvent(
                                                                'openAppointmentDetails',
                                                                {
                                                                    detail: {
                                                                        appointment:
                                                                            appt,
                                                                    },
                                                                },
                                                            ),
                                                        );
                                                    } catch {
                                                        /* noop */
                                                    }
                                                })
                                                .catch(() => {
                                                    window.dispatchEvent(
                                                        new CustomEvent(
                                                            'openAppointmentDetails',
                                                            {
                                                                detail: {
                                                                    appointment:
                                                                        f,
                                                                },
                                                            },
                                                        ),
                                                    );
                                                });
                                        }}
                                    >
                                        <FaEye color={iconColor} />
                                    </button>
                                    <button
                                        className={styles.iconButton}
                                        title='Editar este compromisso'
                                        onClick={e => {
                                            e.stopPropagation();
                                            const token =
                                                localStorage.getItem(
                                                    'accessToken',
                                                );
                                            fetch(
                                                `${API_BASE}/agenda/appointments/${f.id}/`,
                                                {
                                                    headers: {
                                                        Authorization: token
                                                            ? `Bearer ${token}`
                                                            : '',
                                                    },
                                                },
                                            )
                                                .then(r =>
                                                    r.ok ? r.json() : null,
                                                )
                                                .then(data => {
                                                    setEditingAppt(data);
                                                    setShowQuick(true);
                                                })
                                                .catch(() => {
                                                    setEditingAppt({
                                                        ...f,
                                                    } as Appointment);
                                                    setShowQuick(true);
                                                });
                                        }}
                                    >
                                        <FaEdit color={iconColor} />
                                    </button>
                                </div>
                            );
                        })}
                        {futureAppointments.length > 7 && (
                            <div
                                style={{
                                    fontSize: 11,
                                    color: '#6b7280',
                                    padding: '2px 4px',
                                }}
                            >
                                + {futureAppointments.length - 7} outros
                                agendados
                            </div>
                        )}
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
