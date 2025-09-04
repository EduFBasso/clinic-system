// frontend/src/components/ClientCard.tsx
import React from 'react';
import { useNow } from '../hooks/useNow';
import styles from '../styles/components/ClientCard.module.css';
import {
    FaEye,
    FaWhatsapp,
    FaEnvelope,
    FaCalendarAlt,
    FaEdit,
} from 'react-icons/fa';
import type { ClientBasic } from '../types/ClientBasic';
import { formatPhone } from '../utils/formatPhone';
import '../styles/palette.css';
// no direct date-time formatting import needed here
import MonthlyAgendaModal from './MonthlyAgendaModal';
import WeeklyPreviewModal from './WeeklyPreviewModal';
import MiniScheduler from './MiniScheduler';

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
    const [showMini, setShowMini] = React.useState(false);
    const [pressed, setPressed] = React.useState(false);
    // Refresh time-based UI every 30s while visible (lightweight)
    const now = useNow(30000);
    const start = client.next_appointment_start_at
        ? new Date(client.next_appointment_start_at)
        : null;
    const end = client.next_appointment_end_at
        ? new Date(client.next_appointment_end_at)
        : start
        ? new Date(start.getTime() + 60 * 60 * 1000)
        : null; // fallback 1h if backend missing end
    const isScheduled = client.next_appointment_status === 'scheduled';
    const isOngoing =
        isScheduled &&
        !!start &&
        !!end &&
        start.getTime() <= now.getTime() &&
        now.getTime() < end.getTime();
    const amber = '#b45309'; // amber-700 (darker)
    const amberBg = '#fffbeb'; // amber-50 (lighter bg)
    const labelColor = isOngoing ? amber : 'var(--color-primary)';
    const iconColor = isOngoing ? amber : 'var(--color-secondary)';
    // Thicken border when ongoing and either pressed or selected
    const borderWidth = isOngoing && (pressed || selected) ? 2 : 1;
    const cardBorder = isOngoing
        ? `${borderWidth}px solid ${amber}`
        : selected
        ? '2px solid var(--color-selected-border)'
        : '1px solid var(--color-border)';
    const cardBg = isOngoing
        ? amberBg
        : selected
        ? 'var(--color-selected-bg)'
        : 'var(--card-bg)';
    const leftStripeColor = isOngoing ? amber : 'transparent';
    // title display moved into the agenda section below when scheduled
    return (
        <div
            className={styles.card}
            style={{
                background: cardBg,
                border: cardBorder,
                position: 'relative',
                boxShadow: selected
                    ? isOngoing
                        ? `0 0 0 2px ${amber}, 0 2px 6px rgba(0,0,0,0.08)`
                        : '0 0 0 2px var(--color-selected-border), 0 2px 6px rgba(0,0,0,0.08)'
                    : '0 1px 4px rgba(0,0,0,0.08)',
                transition: 'background 0.2s, border 0.2s, box-shadow 0.2s',
                cursor: 'pointer',
            }}
            onClick={onSelect}
            onMouseDown={() => setPressed(true)}
            onMouseUp={() => setPressed(false)}
            onMouseLeave={() => setPressed(false)}
            onTouchStart={() => setPressed(true)}
            onTouchEnd={() => setPressed(false)}
        >
            {isOngoing && (
                <div
                    aria-hidden
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 4,
                        background: leftStripeColor,
                        borderTopLeftRadius: 12,
                        borderBottomLeftRadius: 12,
                    }}
                />
            )}
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
                        style={{
                            color: isOngoing ? amber : 'var(--color-text)',
                            lineHeight: 1.3,
                            fontWeight: isOngoing ? 600 : undefined,
                        }}
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

            <div className={styles.infoRow}>
                <span
                    className={styles.label}
                    style={{
                        color: labelColor,
                        fontWeight: 'bold',
                    }}
                >
                    Tel:
                </span>
                <span
                    className={styles.value}
                    style={{
                        color: isOngoing ? amber : 'var(--color-text)',
                        fontWeight: isOngoing ? 600 : undefined,
                    }}
                >
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
                    style={{
                        color: isOngoing ? amber : 'var(--color-text)',
                        fontWeight: isOngoing ? 600 : undefined,
                    }}
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

            {/* Separator between personal data and agenda info (increased spacing) */}
            {isScheduled && (
                <div
                    aria-hidden
                    style={{
                        height: 1,
                        background: labelColor,
                        opacity: 0.5,
                        margin: '12px 0 12px',
                        borderRadius: 1,
                    }}
                />
            )}

            {/* Agenda section below E-mail, visible only when there is an active appointment */}
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
                            style={{
                                color: isOngoing ? amber : 'var(--color-text)',
                                fontWeight: isOngoing ? 600 : undefined,
                            }}
                        >
                            {client.next_appointment_title || 'Consulta'}
                        </span>
                        <button
                            className={styles.iconButton}
                            title='Agendar rápido'
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
                            style={{ color: labelColor, fontWeight: 'bold' }}
                        >
                            Data:
                        </span>
                        <span
                            className={styles.value}
                            style={{
                                color: isOngoing ? amber : 'var(--color-text)',
                                fontWeight: isOngoing ? 600 : undefined,
                            }}
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
                        <button
                            className={styles.iconButton}
                            title='Editar'
                            onClick={e => {
                                e.stopPropagation();
                                // Abrir agendamento rápido como fluxo principal
                                setShowMini(true);
                            }}
                        >
                            <FaEdit color={iconColor} />
                        </button>
                    </div>
                    {/* Observações: label on one line, text below */}
                    <div className={styles.infoRow}>
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
                                style={{
                                    color: isOngoing
                                        ? amber
                                        : 'var(--color-text)',
                                    fontWeight: isOngoing ? 600 : undefined,
                                }}
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
                <WeeklyPreviewModal
                    open={showWeekly}
                    onClose={() => setShowWeekly(false)}
                />
            )}
            {showMini && (
                <MiniScheduler
                    open={showMini}
                    onClose={() => setShowMini(false)}
                    client={client}
                    defaultDate={start ?? undefined}
                />
            )}
        </div>
    );
}
