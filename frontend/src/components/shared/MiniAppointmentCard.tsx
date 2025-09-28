import React from 'react';

export type MiniStatus = 'ativo' | 'pendente' | 'cancelado' | 'concluido';

export interface MiniAppointmentLike {
  id: number;
  title?: string;
  start_at: string;
  end_at: string;
  client_name?: string;
}

export interface MiniAppointmentCardProps {
  appt: MiniAppointmentLike;
  status: MiniStatus;
  onEdit?: (appt: MiniAppointmentLike) => void; // permitido apenas em 'ativo'
  onCancel?: (appt: MiniAppointmentLike) => void; // permitido em 'ativo' e como ação de finalizar em 'pendente'
  onConclude?: (appt: MiniAppointmentLike) => void; // finalizar para 'pendente'
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

function colorTokens(status: MiniStatus) {
  switch (status) {
    case 'ativo':
      return {
        border: '#10b981',
        bg: 'rgba(16,185,129,0.10)',
        fg: '#065f46',
        bar: '#10b981',
      };
    case 'pendente':
      return {
        border: '#9ca3af',
        bg: 'rgba(156,163,175,0.14)',
        fg: '#374151',
        bar: '#9ca3af',
      };
    case 'cancelado':
      return {
        border: '#ef4444',
        bg: 'rgba(239,68,68,0.10)',
        fg: '#7f1d1d',
        bar: '#ef4444',
      };
    case 'concluido':
      return {
        border: '#3b82f6',
        bg: 'rgba(59,130,246,0.10)',
        fg: '#1e3a8a',
        bar: '#3b82f6',
      };
  }
}

export const MiniAppointmentCard: React.FC<MiniAppointmentCardProps> = ({
  appt,
  status,
  onEdit,
  onCancel,
  onConclude,
  compact = true,
  className,
  style,
}) => {
  const c = colorTokens(status);
  const canEdit = status === 'ativo';
  const canCancel = status === 'ativo' || status === 'pendente';
  const finalizeActions = status === 'pendente';

  const start = new Date(appt.start_at);
  const end = new Date(appt.end_at);
  const hhmm = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  return (
    <div
      className={className}
      style={{
        border: `1px solid ${c.border}`,
        borderLeft: `6px solid ${c.bar}`,
        borderRadius: 8,
        background: c.bg,
        padding: compact ? '6px 10px' : '8px 12px',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 6,
        alignItems: 'center',
        ...style,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span style={{ fontWeight: 800, color: c.fg }}>
            {appt.client_name || 'Cliente'}
          </span>
          {appt.title && (
            <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>
              {appt.title}
            </span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#374151' }}>
            {hhmm(start)}–{hhmm(end)}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {finalizeActions ? (
          <>
            <button
              type='button'
              title='Marcar como Concluído'
              onClick={() => onConclude?.(appt)}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid #3b82f6',
                color: '#1e3a8a',
                background: 'rgba(59,130,246,0.08)',
                cursor: 'pointer',
              }}
            >
              Concluir
            </button>
            <button
              type='button'
              title='Cancelar'
              onClick={() => onCancel?.(appt)}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid #ef4444',
                color: '#7f1d1d',
                background: 'rgba(239,68,68,0.08)',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button
              type='button'
              title='Editar'
              onClick={() => onEdit?.(appt)}
              disabled={!canEdit}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: `1px solid ${canEdit ? c.border : '#e5e7eb'}`,
                color: canEdit ? c.fg : '#9ca3af',
                background: canEdit ? 'rgba(16,185,129,0.08)' : '#f3f4f6',
                cursor: canEdit ? 'pointer' : 'not-allowed',
              }}
            >
              Editar
            </button>
            <button
              type='button'
              title='Cancelar'
              onClick={() => canCancel && onCancel?.(appt)}
              disabled={!canCancel}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: `1px solid ${canCancel ? '#ef4444' : '#e5e7eb'}`,
                color: canCancel ? '#7f1d1d' : '#9ca3af',
                background: canCancel ? 'rgba(239,68,68,0.08)' : '#f3f4f6',
                cursor: canCancel ? 'pointer' : 'not-allowed',
              }}
            >
              Cancelar
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default MiniAppointmentCard;
