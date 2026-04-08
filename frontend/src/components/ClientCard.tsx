// frontend/src/components/ClientCard.tsx
import React from 'react';
import { focusClientCard } from '../utils/focusClientCard';
import styles from '../styles/components/ClientCard.module.css';
import { FaEye, FaWhatsapp, FaCalendarAlt, FaPlus } from 'react-icons/fa';
import { useClientCreateAction } from '../hooks/useClientCreateAction';
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
// PendingActionsModal é gerenciado globalmente (Home) via evento 'pendingActions:open'
import { useClientPendingState } from '../hooks/useClientPendingState';
import FinalizeButton from './clientCard/FinalizeButton';
// SolveButton lives in clientCard folder along with FinalizeButton
import SolveButton from './clientCard/SolveButton';
import {
    FutureAppointmentsList,
    useClientFutureAppointments,
} from '../domain/futureAppointments';
// (hysteresis & appointment state consolidated inside hooks)
import { useFinalizeAppointment } from '../hooks/useFinalizeAppointment';
// Replaced latch/snapshot/sweep logic by consolidated hook
import { useClientOngoingState } from '../hooks/useClientOngoingState';
import { formatTime } from '../utils/timeFormat';
import { openClientForm } from '../utils/openClientForm';
import BudgetModal from './BudgetModal';
import { useNowTick } from '../hooks/useNowTick';

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
    // Removido: PendingActions local — usar evento global
    const [editingAppt, setEditingAppt] = React.useState<Appointment | null>(
        null,
    );
    const isScheduled = client.next_appointment_status === 'scheduled';
    // Futuros agora gerenciados por hook dedicado
    const { futureAppointments, loadingFuture, dynLimit } =
        useClientFutureAppointments({ client, isScheduled });
    const [pressed, setPressed] = React.useState(false);
    const { finishing, finalize } = useFinalizeAppointment(client.id);
    // Suprimir visual de "em andamento" por alguns segundos após finalizar/cancelar
    // suppressOngoingUntil removido (gestão dentro do hook de ongoing)
    // Tick a cada 5 s para refletir mudanças de estado (scheduled→ongoing) sem interação do usuário
    const now = useNowTick(5000);
    // Removed resumeGrace (was used for previous ongoing suppression logic)
    // const resumeGrace = useVisibilityResumeGrace(30000);
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
    // isScheduled já definido acima (reordenado para hook de futuros)
    // Base: informações vindas do servidor (se disponíveis)
    // startISO / endISO no longer directly used after ongoing refactor
    // const startISO = client.next_appointment_start_at ?? null;
    // const endISO = client.next_appointment_end_at ?? null;
    const {
        isOngoing,
        // isOngoingRaw (raw signal) not needed in card after refactor
        displayStartISO,
        displayEndISO,
        effectiveApptId,
        afterFinalizeSuccess,
    } = useClientOngoingState({
        client,
        now,
        enableProbe: ENABLE_ONGOING_PROBE,
        debug: false,
    });

    // Quando tivermos uma janela confiável e status scheduled, usamos o hook compartilhado
    // legacy variables now derived via hook (kept for potential future use) startISO/endISO still used for future fetch logic

    // Preferir dados confiáveis do servidor OU da varredura global quando houver janela atual
    // Se houver um agendamento em andamento detectado pela varredura (windowFromOverride),
    // usamos esse horário/ID em prioridade para refletir corretamente o estado "Em andamento".
    // removed: local derivations now handled by useClientOngoingState

    // Auto-clear latch some time after the end to avoid sticky ongoing if finalize didn't fire
    // removed auto-clear effect (handled inside hook)

    // Novo: limpar latch imediatamente se detectarmos que o appointment latched foi finalizado/cancelado, expirado ou janela deixou de ser confiável
    // removed immediate-clear effect (handled in hook)

    // On resume (visibility/pageshow), refresh local latched state from storage in case iOS flushed memory
    // removed visibility storage refresh (handled in hook)

    // Aplicar histerese visual: aguarda 250ms para entrar em ongoing; saída é imediata
    // hysteresis now inside hook (isOngoing already stabilized)

    // Instrumentação de diagnóstico opcional: loga decisão de ongoing/latch
    // removed debug effect (handled via hook's debug option)

    // Telemetry: entering ongoing window
    // removed telemetry enter effect (done inside hook)

    // Hook centralizado de pendência
    const {
        effectivePending: isPending,
        openPendingActions,
        tryOpenPendingElseQuick,
    } = useClientPendingState({ client, now });

    // Mostrar seção de agenda somente se há algo concreto (agendamento atual ou em andamento) ou futuros carregados.
    // Estado pendente isolado não exibe cabeçalho/tipo para manter UI minimalista.
    // Agenda line (tipo / horário) é suprimida se pendente para manter visual minimalista.
    // Porém queremos ainda exibir a linha 'Data:' com o botão Solucionar mesmo que haja um agendamento (scheduled+pending).
    // Regra revisada:
    //  - Quando pendente: não mostramos linha de agenda nem linha Data (substituímos por bloco compacto de pendência)
    //  - Linha de agenda aparece apenas se há scheduled ativo, em andamento ou futuros E não está pendente
    const hasAgendaLine =
        !isPending &&
        (isScheduled || isOngoing || futureAppointments.length > 0);

    // Ações unificadas (+) para agenda e fallback
    const createActionAgenda = useClientCreateAction({
        isOngoing,
        isPending,
        futureAppointmentsCount: futureAppointments.length,
        isScheduled,
        dynLimit,
        openPendingActions,
        tryOpenPendingElseQuick,
        setEditing: setEditingAppt,
        openQuick: () => setShowQuick(true),
        baseTitle: 'Novo agendamento',
    });
    const createActionFallback = useClientCreateAction({
        isOngoing,
        isPending,
        futureAppointmentsCount: futureAppointments.length,
        isScheduled,
        dynLimit,
        openPendingActions,
        tryOpenPendingElseQuick,
        setEditing: setEditingAppt,
        openQuick: () => setShowQuick(true),
        baseTitle: 'Agendar',
    });
    // Estilos centralizados via hook: mantém regra de cartão branco durante atendimento
    const {
        containerStyle,
        labelColor,
        iconColor,
        valueColor,
        separatorColor,
        separatorOpacity,
    } = useClientCardStyle({
        isOngoing,
        selected,
        pressed,
        isScheduled,
        isPending,
    });
    const cardRef = React.useRef<HTMLDivElement | null>(null);
    const [budgetOpen, setBudgetOpen] = React.useState(false);

    // Align with global forceClose: ensure any ClientCard modal closes too
    // PendingActions global — sem necessidade de listener local

    // Finalização com encapsulamento via hook
    const finalizeEarlyAware = React.useCallback(async () => {
        const apptId = effectiveApptId;
        if (!apptId) return;
        const ok = await finalize(apptId, {
            preferEarly: isOngoing,
            openPendingAfter: async () => {
                await tryOpenPendingElseQuick(() => {});
            },
        });
        if (ok) afterFinalizeSuccess();
    }, [
        effectiveApptId,
        isOngoing,
        finalize,
        tryOpenPendingElseQuick,
        afterFinalizeSuccess,
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
    }, [
        client.id,
        onSelect,
        futureAppointments.length,
        isOngoing,
        isScheduled,
    ]);

    // Inline effect de futuros removido (substituído pelo hook)

    // Clear ongoing visual immediately when a targeted event is dispatched (same-tab UX)
    // Clear ongoing event handling moved to hook; listener removed

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
                <div className={styles.nameActions}>
                    <button
                        className={styles.iconButton}
                        title='Editar cliente'
                        onClick={e => {
                            e.stopPropagation();
                            const token = localStorage.getItem('accessToken');
                            if (!token) {
                                onView(client);
                                return;
                            }
                            openClientForm({ id: client.id });
                        }}
                    >
                        <FaEdit color={iconColor} />
                    </button>
                    <button
                        className={styles.iconButton}
                        title='Visualizar detalhes'
                        onClick={e => {
                            e.stopPropagation();
                            onView(client);
                        }}
                        style={
                            client.photo
                                ? { padding: 0, overflow: 'hidden' }
                                : undefined
                        }
                    >
                        {client.photo ? (
                            <img
                                src={client.photo}
                                alt={`Foto de ${client.first_name} ${client.last_name}`}
                                className={styles.clientThumb}
                                loading='lazy'
                                decoding='async'
                                onError={ev => {
                                    try {
                                        (
                                            ev.currentTarget as HTMLImageElement
                                        ).style.display = 'none';
                                    } catch {
                                        /* noop */
                                    }
                                }}
                            />
                        ) : (
                            <FaEye color={iconColor} />
                        )}
                    </button>
                </div>
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
                <button
                    className={styles.iconButton}
                    title='Orçamento via WhatsApp'
                    onClick={e => {
                        e.stopPropagation();
                        setBudgetOpen(true);
                    }}
                >
                    <span
                        style={{
                            fontWeight: 900,
                            color: iconColor,
                            fontFamily:
                                'system-ui, Segoe UI, Roboto, sans-serif',
                        }}
                        aria-hidden
                    >
                        🧾
                    </span>
                </button>
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
                    {/* Email sending removed intentionally */}
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

            {/* Agenda section below E-mail. Exibe durante agendamento OU enquanto em andamento (hasAgendaLine). */}
            {hasAgendaLine && (
                <>
                    {(isScheduled ||
                        isOngoing ||
                        futureAppointments.length > 0) && (
                        <div className={styles.infoRow}>
                            <span
                                className={styles.label}
                                style={{
                                    color: labelColor,
                                    fontWeight: 'bold',
                                }}
                            >
                                Agenda (tipo):
                            </span>
                            <span
                                className={styles.value}
                                style={{ color: valueColor }}
                            >
                                {client.next_appointment_title || 'Consulta'}
                            </span>
                            {isPending ? (
                                <SolveButton
                                    onSolve={async () => {
                                        try {
                                            onSelect?.();
                                        } catch {
                                            /* noop */
                                        }
                                        // Usa mesma lógica do minicard daily: tenta abrir pendente ou fallback rápido
                                        await tryOpenPendingElseQuick(() => {
                                            // Se não houver nada pendente inesperadamente, apenas não faz nada (ou poderíamos abrir criação)
                                        });
                                    }}
                                />
                            ) : (
                                <>
                                    <button
                                        className={styles.iconButton}
                                        title={createActionAgenda.title}
                                        disabled={createActionAgenda.disabled}
                                        style={
                                            createActionAgenda.disabled
                                                ? {
                                                      opacity: 0.45,
                                                      cursor: 'not-allowed',
                                                  }
                                                : undefined
                                        }
                                        onClick={createActionAgenda.onClick}
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
                            )}
                        </div>
                    )}
                    <div className={styles.infoRow}>
                        <span
                            className={styles.label}
                            style={{ color: labelColor, fontWeight: 'bold' }}
                        >
                            Data:
                        </span>
                        <span
                            className={styles.value}
                            style={{ color: labelColor, fontWeight: 'bold' }}
                        >
                            {(() => {
                                const sIso =
                                    displayStartISO ||
                                    client.next_appointment_start_at ||
                                    null;
                                const eIso =
                                    displayEndISO ||
                                    client.next_appointment_end_at ||
                                    null;
                                if (!sIso || !eIso) return '—';
                                const s = new Date(sIso);
                                const e = new Date(eIso);
                                if (isNaN(s.getTime()) || isNaN(e.getTime()))
                                    return '—';
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
                                const fs = formatTime(sIso);
                                const fe = formatTime(eIso);
                                return `${wd} ${dd}/${mm}, ${fs} - ${fe}`;
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
                    {(isScheduled || isOngoing) &&
                        client.next_appointment_notes?.trim() && (
                            <div
                                className={styles.infoRow}
                                style={{ paddingTop: 2 }}
                            >
                                <span
                                    className={styles.value}
                                    style={{
                                        color: valueColor,
                                        fontSize: 13,
                                        lineHeight: 1.35,
                                        whiteSpace: 'pre-wrap',
                                        overflowWrap: 'anywhere',
                                    }}
                                >
                                    <span className={styles.notesText}>
                                        {client.next_appointment_notes.trim()}
                                    </span>
                                </span>
                            </div>
                        )}
                    {isOngoing && (
                        <div
                            className={styles.infoRow}
                            style={{ paddingTop: 2 }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    width: '100%',
                                    gap: 12,
                                }}
                            >
                                <span
                                    style={{
                                        background: 'var(--color-ongoing)',
                                        color: '#fff',
                                        borderRadius: 6,
                                        padding: '2px 8px',
                                        fontWeight: 700,
                                        fontSize: 12,
                                        lineHeight: 1.2,
                                    }}
                                >
                                    Em andamento
                                </span>
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
                    {isScheduled && !isOngoing && (
                        <div
                            className={styles.infoRow}
                            style={{ paddingTop: 2 }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    width: '100%',
                                }}
                            >
                                <button
                                    type='button'
                                    className={`${styles.actionButton} ${styles.actionScheduled}`}
                                    title='Enviar aviso de confirmação via WhatsApp'
                                    style={{ fontWeight: 700 }}
                                    onClick={e => {
                                        e.stopPropagation();
                                        const sIso =
                                            displayStartISO ||
                                            client.next_appointment_start_at ||
                                            null;
                                        const time = sIso
                                            ? formatTime(sIso)
                                            : '—';
                                        const visitType =
                                            client.next_appointment_title ||
                                            'Consulta';
                                        const waText = `Olá ${client.first_name}, ${visitType} agendada para as ${time}, confirma sua presença?`;
                                        const rawPhone = (
                                            client.phone || ''
                                        ).replace(/\D/g, '');
                                        const waPhone =
                                            rawPhone &&
                                            !rawPhone.startsWith('55')
                                                ? `55${rawPhone}`
                                                : rawPhone;
                                        if (!waPhone) return;
                                        window.open(
                                            `https://wa.me/${waPhone}?text=${encodeURIComponent(waText)}`,
                                            '_blank',
                                        );
                                    }}
                                >
                                    Avisar
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Fallback bloco removido: Data agora unificada acima usando displayStartISO/displayEndISO */}

            {/* Linha Data fallback revisada: só aparece quando NÃO há agenda line, NÃO está pendente e NÃO está em andamento. */}
            {!hasAgendaLine && !isPending && !isOngoing && (
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
                        {isScheduled ? 'Agendado' : 'Sem agendamento'}
                    </span>
                    <button
                        className={styles.iconButton}
                        title={createActionFallback.title}
                        disabled={createActionFallback.disabled}
                        style={
                            createActionFallback.disabled
                                ? { opacity: 0.45, cursor: 'not-allowed' }
                                : undefined
                        }
                        onClick={createActionFallback.onClick}
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
                </div>
            )}

            {/* Bloco compacto de pendência substitui linha Data e ícones quando pendente (independente de scheduled). */}
            {isPending && !isOngoing && (
                <div
                    className={styles.infoRow}
                    style={{ alignItems: 'center' }}
                >
                    <span
                        className={styles.label}
                        style={{ color: labelColor, fontWeight: 'bold' }}
                    >
                        Status:
                    </span>
                    <span
                        className={styles.value}
                        style={{
                            color: 'var(--color-text-secondary, #6b7280)',
                            fontStyle: 'italic',
                        }}
                    >
                        Compromisso pendente
                    </span>
                    <SolveButton
                        onSolve={async () => {
                            try {
                                onSelect?.();
                            } catch {
                                /* noop */
                            }
                            await tryOpenPendingElseQuick(() => {
                                /* noop fallback */
                            });
                        }}
                    />
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
            {/* PendingActionsModal é global (Home) */}
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
                            <div
                                style={{
                                    fontSize: 11,
                                    color: 'var(--color-text-muted)',
                                }}
                            >
                                Carregando…
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* Modal de Cobrança independente da agenda */}
            {/* charge modal removed */}
            {budgetOpen && (
                <BudgetModal
                    open={budgetOpen}
                    onClose={() => setBudgetOpen(false)}
                    clientName={`${client.first_name} ${client.last_name}`}
                    clientPhone={client.phone}
                />
            )}
        </div>
    );
}
