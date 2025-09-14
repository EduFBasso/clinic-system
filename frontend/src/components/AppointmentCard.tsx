import React from 'react';
import type { Appointment } from '../hooks/useAppointments';
import { FaEdit, FaBan } from 'react-icons/fa';

export default function AppointmentCard({
    appt,
    onEdit,
    onCancel,
    onUseTime,
    highlight, // highlight temporário (ex: pós criação/atualização)
    editingActive, // highlight persistente enquanto em edição
    pulse, // animação de pulsar (usada nos primeiros segundos da edição)
}: {
    appt: Appointment;
    onEdit?: (appt: Appointment) => void;
    onCancel?: (appt: Appointment) => void;
    onUseTime?: (appt: Appointment) => void;
    highlight?: boolean;
    editingActive?: boolean;
    pulse?: boolean;
}) {
    const s = new Date(appt.start_at);
    const e = new Date(appt.end_at);
    const now = new Date();
    const expired = e.getTime() < now.getTime();
    const canceled = appt.status === 'canceled';
    const color = canceled ? '#ef4444' : expired ? '#9ca3af' : '#10b981';
    const canEdit = appt.status === 'scheduled' && !expired && !canceled;
    const canCancel = appt.status === 'scheduled' && !expired && !canceled;

    function hhmm(d: Date) {
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
    }

    // Map visit type for display (fallback to title)
    const visitTypeLabelMap: Record<string, string> = {
        avaliacao: 'Avaliação',
        retorno: 'Retorno',
        procedimento: 'Procedimento',
        outro: 'Outro',
        consulta: 'Consulta',
    };
    const visitTypeLabel =
        visitTypeLabelMap[appt.visit_type] || appt.title || 'Consulta';

    const hasNotes = !!appt.notes;
    const gridTemplateAreas = hasNotes ? '"t a" "y a" "n n"' : '"t a" "y a"';
    const gridTemplateRows = hasNotes ? 'auto auto auto' : 'auto auto';

    // Injeta keyframes de animação apenas uma vez
    React.useEffect(() => {
        if (typeof document === 'undefined') return;
        const existing = document.getElementById('appt-card-animations');
        if (!existing) {
            const styleEl = document.createElement('style');
            styleEl.id = 'appt-card-animations';
            styleEl.textContent = `@keyframes apptPulseBorderThin {0%,100% {box-shadow: 0 0 0 1px var(--pulse-color), 0 1px 3px rgba(0,0,0,0.08);}50% {box-shadow: 0 0 0 3px var(--pulse-color), 0 2px 5px rgba(0,0,0,0.15);} }`;
            document.head.appendChild(styleEl);
        }
    }, []);

    // Mesma família de tom da faixa lateral, porém translúcido no fundo para manter legibilidade.
    const editingBg = canceled
        ? 'rgba(239,68,68,0.10)'
        : expired
        ? 'rgba(156,163,175,0.14)'
        : 'rgba(16,185,129,0.14)';
    const editingBoxShadow = editingActive
        ? pulse
            ? '0 0 0 1px var(--pulse-color), 0 1px 3px rgba(0,0,0,0.08)'
            : '0 0 0 1px var(--pulse-color), 0 1px 2px rgba(0,0,0,0.06)'
        : undefined;
    const creationHighlightBoxShadow = highlight
        ? '0 0 0 2px #3b82f6 inset, 0 1px 3px rgba(0,0,0,0.08)'
        : undefined;
    const baseBackground = editingActive
        ? editingBg
        : highlight
        ? '#eef6ff'
        : '#fff';

    const pulseColor = canceled
        ? 'rgba(185,28,28,0.55)'
        : expired
        ? 'rgba(107,114,128,0.50)'
        : 'rgba(16,185,129,0.55)';

    // Duração aprox. de 1 ciclo: 1.15s -> 3 ciclos ~3.45s
    const pulseAnimation = 'apptPulseBorderThin 1.15s ease-in-out 0s 3';

    return (
        <div
            id={`appt-card-${appt.id}`}
            style={
                {
                    '--pulse-color': pulseColor,
                    // Quando em edição, remover o "espaço em branco" perceptível entre a faixa e a borda pulsante
                    // usando a mesma cor base na borda (ou aproximado via var(--pulse-color)).
                    border: editingActive
                        ? '1px solid ' + color
                        : '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: '6px 10px 6px 12px',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gridTemplateAreas,
                    gridTemplateRows,
                    columnGap: 10,
                    rowGap: 2,
                    background: baseBackground,
                    boxShadow:
                        editingBoxShadow ||
                        creationHighlightBoxShadow ||
                        'none',
                    position: 'relative',
                    lineHeight: 1.25,
                    transition: 'background 0.35s, box-shadow 0.35s',
                    animation:
                        editingActive && pulse ? pulseAnimation : undefined,
                } as React.CSSProperties
            }
            onClick={() => onUseTime && onUseTime(appt)}
        >
            <div
                aria-hidden
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 5,
                    background: color,
                    borderTopLeftRadius: 8,
                    borderBottomLeftRadius: 8,
                }}
            />
            {/* Linha 1 */}
            <div
                style={{
                    gridArea: 't',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#111827',
                    minWidth: 0,
                }}
            >
                <span>
                    {hhmm(s)} - {hhmm(e)}
                </span>
                <span style={{ color: '#6b7280' }}>•</span>
                <span style={{ fontWeight: 600 }}>
                    {appt.client_name || 'Cliente'}
                </span>
            </div>
            {/* Linha 2 */}
            <div
                style={{
                    gridArea: 'y',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12.5,
                    color: '#374151',
                    minWidth: 0,
                }}
            >
                <span>
                    <strong>Tipo:</strong>{' '}
                    <span style={{ fontWeight: 600 }}>{visitTypeLabel}</span>
                </span>
                {canceled && (
                    <span
                        style={{
                            background: '#fee2e2',
                            color: '#991b1b',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                        }}
                    >
                        Cancelado
                    </span>
                )}
                {expired && !canceled && (
                    <span
                        style={{
                            background: '#f3f4f6',
                            color: '#374151',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                        }}
                    >
                        Expirado
                    </span>
                )}
            </div>
            {/* Ícones (não ocupam linha 3) */}
            <div
                style={{
                    gridArea: 'a',
                    display: 'flex',
                    gap: 6,
                    alignSelf: 'center',
                }}
            >
                <button
                    type='button'
                    title={canEdit ? 'Editar' : 'Edição indisponível'}
                    onClick={e => {
                        e.stopPropagation();
                        if (canEdit && onEdit) onEdit(appt);
                    }}
                    disabled={!canEdit}
                    style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        background: canEdit ? '#f3f4f6' : '#f9fafb',
                        padding: 6,
                        cursor: canEdit ? 'pointer' : 'not-allowed',
                    }}
                >
                    <FaEdit color={canEdit ? '#111827' : '#9ca3af'} />
                </button>
                <button
                    type='button'
                    title={canCancel ? 'Cancelar' : 'Não pode cancelar'}
                    onClick={evt => {
                        evt.stopPropagation();
                        if (!canCancel || !onCancel) return;
                        const msg = `Tem certeza que deseja cancelar o agendamento de ${hhmm(
                            s,
                        )} - ${hhmm(e)}${
                            appt.client_name ? ' para ' + appt.client_name : ''
                        }?`;
                        // Using native confirm for speed; can be replaced later by custom modal for consistent styling.
                        if (window.confirm(msg)) {
                            onCancel(appt);
                        }
                    }}
                    disabled={!canCancel}
                    style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        background: canCancel ? '#fef2f2' : '#f9fafb',
                        padding: 6,
                        cursor: canCancel ? 'pointer' : 'not-allowed',
                    }}
                >
                    <FaBan color={canCancel ? '#b91c1c' : '#9ca3af'} />
                </button>
            </div>
            {/* Linha 3: Observações (span full width) */}
            {hasNotes && (
                <div
                    title={appt.notes}
                    style={{
                        gridArea: 'n',
                        fontSize: 12,
                        color: '#4b5563',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%',
                    }}
                >
                    <strong>Observações:</strong> {appt.notes}
                </div>
            )}
        </div>
    );
}
