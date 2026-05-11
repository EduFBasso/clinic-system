// frontend/src/components/ClientCard.tsx
import React from 'react';
import { focusClientCard } from '../utils/focusClientCard';
import styles from '../styles/components/ClientCard.module.css';
import {
    FaEye,
    FaWhatsapp,
    FaCalendarAlt,
    FaPlus,
    FaTooth,
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useClientCreateAction } from '../hooks/useClientCreateAction';
import { API_BASE } from '../config/api';
import type { Appointment } from '../hooks/useAppointments';
import type { ClientBasic } from '../types/ClientBasic';
import { formatPhone } from '../utils/formatPhone';
import { FaEdit } from 'react-icons/fa';
import '../styles/palette.css';
import { parseDOB, calcAge } from '../utils/dateOfBirth';
import { useClientCardStyle } from './clientCard/useClientCardStyle';
// PendingActionsModal é gerenciado globalmente (Home) via evento 'pendingActions:open'
import { useClientPendingState } from '../hooks/useClientPendingState';
import FinalizeButton from './clientCard/FinalizeButton';
// SolveButton lives in clientCard folder along with FinalizeButton
import SolveButton from './clientCard/SolveButton';
import { useClientCardFocusScroll } from './clientCard/useClientCardFocusScroll';
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
import { emit } from '../events/bus';
import { getAccessToken } from '../utils/auth/session';

interface ClientCardProps {
    client: ClientBasic;
    onView: (client: ClientBasic) => void;
    selected?: boolean;
    onSelect?: () => void;
    /** Quando definido, o botão "Avisar" usa este agendamento em vez do next_appointment do cliente.
     *  Útil quando o filtro ativo é "Amanhã" e o cliente tem um agendamento amanhã distinto do next. */
    notifyAppt?: { start_at?: string; end_at?: string; title?: string };
    /** Modo de filtro ativo. Quando 'today' ou 'tomorrow', o card exibe apenas o dia filtrado. */
    filterMode?: 'all' | 'pending' | 'today' | 'tomorrow';
}

function ClientCard({
    client,
    onView,
    selected,
    onSelect,
    notifyAppt,
    filterMode = 'all',
}: ClientCardProps) {
    const navigate = useNavigate();
    // Feature flag: disable per-client ongoing probe unless explicitly enabled (reduces debug traffic)
    const ENABLE_ONGOING_PROBE =
        (import.meta as ImportMeta).env.VITE_ENABLE_ONGOING_PROBE === 'true';
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
    const canAccessOdontoArcade = React.useMemo(() => {
        try {
            const stored = localStorage.getItem('loggedProfessional');
            if (!stored) return false;
            const professional = JSON.parse(stored) as { specialty?: string };
            const specialty = (professional.specialty || '')
                .toString()
                .trim()
                .toLowerCase();
            return (
                specialty.includes('odonto') ||
                specialty.includes('dent') ||
                specialty.includes('ortodont')
            );
        } catch {
            return false;
        }
    }, []);
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
    } = useClientPendingState({ client, now, probeEnabled: ENABLE_ONGOING_PROBE });

    // Mostrar seção de agenda somente se há algo concreto (agendamento atual ou em andamento) ou futuros carregados.
    // Estado pendente isolado não exibe cabeçalho/tipo para manter UI minimalista.
    // Agenda line (tipo / horário) é suprimida se pendente para manter visual minimalista.
    // Porém queremos ainda exibir a linha 'Data:' com o botão Solucionar mesmo que haja um agendamento (scheduled+pending).
    // Regra revisada:
    //  - Quando pendente: não mostramos linha de agenda nem linha Data (substituímos por bloco compacto de pendência)
    //  - Linha de agenda aparece apenas se há scheduled ativo, em andamento ou futuros E não está pendente
    // isTomorrowFilter / effectiveOngoing declarados aqui porque hasAgendaLine (abaixo) os usa
    const isTomorrowFilter = filterMode === 'tomorrow' && !!notifyAppt;
    const effectiveOngoing = isOngoing && !isTomorrowFilter;

    const hasAgendaLine =
        !isPending &&
        (isScheduled || effectiveOngoing || futureAppointments.length > 0);

    // Ações unificadas (+) para agenda e fallback
    const createActionAgenda = useClientCreateAction({
        isOngoing,
        isPending,
        futureAppointmentsCount: futureAppointments.length,
        isScheduled,
        dynLimit,
        openPendingActions,
        tryOpenPendingElseQuick,
        setEditing: () => {
            /* noop: scheduling flow is hosted globally in Home */
        },
        openQuick: () => openGlobalQuickSchedule(),
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
        setEditing: () => {
            /* noop: scheduling flow is hosted globally in Home */
        },
        openQuick: () => openGlobalQuickSchedule(),
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
        isOngoing: effectiveOngoing,
        selected,
        pressed,
        isScheduled,
        isPending,
    });
    const openGlobalQuickSchedule = React.useCallback(
        (appointment?: Appointment | null) => {
            try {
                window.dispatchEvent(
                    new CustomEvent('openScheduleEdit', {
                        detail: {
                            client,
                            appointment: appointment ?? undefined,
                        },
                    }),
                );
            } catch {
                /* noop */
            }
        },
        [client],
    );
    const cardRef = React.useRef<HTMLDivElement | null>(null);
    const [budgetOpen, setBudgetOpen] = React.useState(false);

    const openGlobalMonthlyAgenda = React.useCallback(
        (dateISO?: string | null) => {
            try {
                emit('openMonthlyAgenda', {
                    clientId: client.id,
                    date: dateISO || undefined,
                });
            } catch {
                /* noop */
            }
        },
        [client.id],
    );

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
        if (ok) {
            afterFinalizeSuccess();
            // Rola e foca o card após fechar o modal de finalização (mesmo padrão da notificação push)
            focusClientCard(client.id, { delayMs: 400 });
        }
    }, [
        effectiveApptId,
        isOngoing,
        finalize,
        tryOpenPendingElseQuick,
        afterFinalizeSuccess,
        client.id,
    ]);
    // Fechar modo edição ao clicar fora do card
    // Efeito de clique fora removido enquanto editor inline está desativado
    // Borda e fundo já definidos no hook (containerStyle)
    // title display moved into the agenda section below when scheduled
    // Flash visual ao focar/entrar em andamento removido — mantemos apenas seleção + scroll
    useClientCardFocusScroll({
        clientId: client.id,
        cardRef,
        onSelect,
        futureAppointmentsCount: futureAppointments.length,
        isOngoing,
        isScheduled,
    });

    // Inline effect de futuros removido (substituído pelo hook)

    // Clear ongoing visual immediately when a targeted event is dispatched (same-tab UX)
    // Clear ongoing event handling moved to hook; listener removed

    // Quando o filtro ativo é 'tomorrow' e temos o agendamento de amanhã, usamos seus dados
    // para o bloco "Data:" e o botão "Avisar" — substituindo os dados de hoje.
    // (isTomorrowFilter e effectiveOngoing já declarados acima, antes de hasAgendaLine)
    const activeStartISO = isTomorrowFilter
        ? (notifyAppt?.start_at ?? null)
        : (displayStartISO || client.next_appointment_start_at || null);
    const activeEndISO = isTomorrowFilter
        ? (notifyAppt?.end_at ?? null)
        : (displayEndISO || client.next_appointment_end_at || null);
    // Ocultar o bloco "Próximos compromissos" quando um filtro de dia específico está ativo
    const hideFutureList = filterMode === 'today' || filterMode === 'tomorrow';
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
                    {canAccessOdontoArcade && (
                        <button
                            className={styles.iconButton}
                            title='Abrir prontuario odontologico'
                            onClick={e => {
                                e.stopPropagation();
                                navigate(`/odonto/arcada/${client.id}`);
                            }}
                        >
                            <FaTooth color={iconColor} />
                        </button>
                    )}
                    <button
                        className={styles.iconButton}
                        title='Editar cliente'
                        onClick={e => {
                            e.stopPropagation();
                            const token = getAccessToken();
                            if (!token) {
                                onView(client);
                                return;
                            }
                            openClientForm({ id: client.id, navigate });
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
                            color: 'var(--color-primary)',
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
                        {client.address_complement && (
                            <span style={{ marginLeft: 4 }}>
                                — {client.address_complement}
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
                        effectiveOngoing ||
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
                                        }, {
                                            kind: 'home',
                                            clientId: client.id,
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
                                            openGlobalMonthlyAgenda(
                                                displayStartISO ||
                                                    client.next_appointment_start_at ||
                                                    null,
                                            );
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
                                const sIso = activeStartISO;
                                const eIso = activeEndISO;
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
                        {client.next_appointment_id && !effectiveOngoing && (
                            <button
                                className={styles.iconButton}
                                title='Editar agendamento'
                                onClick={e => {
                                    e.stopPropagation();
                                    const token =
                                        getAccessToken();
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
                                            openGlobalQuickSchedule(data);
                                        })
                                        .catch(() => {
                                            openGlobalQuickSchedule();
                                        });
                                }}
                            >
                                <FaEdit color={iconColor} />
                            </button>
                        )}
                    </div>
                    {(isScheduled || effectiveOngoing) &&
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
                    {effectiveOngoing && (
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
                    {isScheduled && !effectiveOngoing && (
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
                                    title={client.phone ? 'Enviar aviso de confirmação via WhatsApp' : 'Telefone não cadastrado'}
                                    style={{ fontWeight: 700, opacity: client.phone ? 1 : 0.45 }}
                                    onClick={e => {
                                        e.stopPropagation();
                                        if (!client.phone) {
                                            alert('Telefone não cadastrado para este cliente.');
                                            return;
                                        }
                                        // Prioridade: activeStartISO (já resolve tomorrow ou today corretamente)
                                        const sIso = activeStartISO;
                                        const time = sIso
                                            ? formatTime(sIso)
                                            : '—';
                                        const visitType =
                                            notifyAppt?.title ||
                                            client.next_appointment_title ||
                                            'Consulta';
                                        const profRaw =
                                            localStorage.getItem(
                                                'loggedProfessional',
                                            );
                                        const profFirstName: string = profRaw
                                            ? (() => {
                                                  try {
                                                      const p =
                                                          JSON.parse(profRaw);
                                                      return (
                                                          p?.display_name ||
                                                          p?.first_name ||
                                                          ''
                                                      );
                                                  } catch {
                                                      return '';
                                                  }
                                              })()
                                            : '';
                                        const profPart = profFirstName
                                            ? ` com ${profFirstName}`
                                            : '';
                                        // Rótulo do dia: compara data real do agendamento com hoje/amanhã
                                        const apptDate = sIso ? new Date(sIso) : null;
                                        const datePart = apptDate && !isNaN(apptDate.getTime())
                                            ? `, ${String(apptDate.getDate()).padStart(2, '0')}/${String(apptDate.getMonth() + 1).padStart(2, '0')}`
                                            : '';
                                        let dayLabel: string;
                                        if (apptDate && !isNaN(apptDate.getTime())) {
                                            const _now = new Date();
                                            const todayDay = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate());
                                            const tomorrowDay = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate() + 1);
                                            const apptDay = new Date(apptDate.getFullYear(), apptDate.getMonth(), apptDate.getDate());
                                            if (apptDay.getTime() === tomorrowDay.getTime()) {
                                                dayLabel = `amanhã${datePart}`;
                                            } else if (apptDay.getTime() === todayDay.getTime()) {
                                                dayLabel = `hoje${datePart}`;
                                            } else {
                                                dayLabel = datePart.replace(/^, /, '');
                                            }
                                        } else {
                                            dayLabel = 'hoje';
                                        }
                                        const waText = `Olá ${client.first_name}, ${visitType} agendada para ${dayLabel} às ${time}${profPart}, confirma sua presença?`;
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
                            openGlobalMonthlyAgenda(
                                client.next_appointment_start_at || null,
                            );
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
                            }, {
                                kind: 'home',
                                clientId: client.id,
                            });
                        }}
                    />
                </div>
            )}

            {/* Notas do próximo agendamento removidas conforme solicitação */}

            {/* Linha inferior de atalhos substituída pela seção "Opções da agenda" acima */}

            {/* PendingActionsModal é global (Home) */}
            {/* QuickScheduleModal é agora o único fluxo de agendamento (ScheduleModal legacy removido) */}
            {futureAppointments.length > 0 && !hideFutureList && (
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
                                openGlobalQuickSchedule(appt);
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

function sameNotifyAppt(
    left?: ClientCardProps['notifyAppt'],
    right?: ClientCardProps['notifyAppt'],
) {
    return (
        left?.start_at === right?.start_at &&
        left?.end_at === right?.end_at &&
        left?.title === right?.title
    );
}

export default React.memo(ClientCard, (prev, next) => {
    return (
        prev.client === next.client &&
        prev.selected === next.selected &&
        prev.filterMode === next.filterMode &&
        sameNotifyAppt(prev.notifyAppt, next.notifyAppt)
    );
});
