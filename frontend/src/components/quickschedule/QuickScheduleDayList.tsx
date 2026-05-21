import React from 'react';
import ClientDayList from '../shared/ClientDayList';
import type { Appointment } from '../../hooks/useAppointments';
import type { PendingReturnContext } from '../../types/agendaFlow';
import { openPendingActionsForAppointment } from '../../utils/appointments/openPendingActions';
import { getNow } from '../../utils/now';

export type DayFilter = 'todos' | 'ativos' | 'cancelados';

export interface QuickScheduleDayListProps {
    appointments: Appointment[];
    loading: boolean;
    dayFilter: DayFilter;
    onChangeFilter: (f: DayFilter) => void;
    sectionDateTitle: string;
    highlightId: number | null;
    conflictHighlightIds?: number[];
    editingHighlightId: number | null;
    currentEditId: number | null;
    listRef?: React.RefObject<HTMLDivElement | null>;
    onUseTime: (a: Appointment) => void;
    onEdit: (a: Appointment) => void;
    onCancel: (a: Appointment) => Promise<void>;
    onFinalize?: (a: Appointment) => Promise<void> | void;
    finalizeRequestContext?: PendingReturnContext;
    onDetails?: (a: Appointment) => void;
    minimal?: boolean; // when true, hide header/select and section title; show only minicards
}

export const QuickScheduleDayList: React.FC<QuickScheduleDayListProps> = ({
    appointments,
    loading,
    dayFilter,
    onChangeFilter,
    sectionDateTitle,
    highlightId,
    conflictHighlightIds = [],
    editingHighlightId,
    currentEditId,
    listRef,
    onUseTime,
    onEdit,
    onCancel,
    onFinalize,
    finalizeRequestContext,
    onDetails,
    minimal = false,
}) => {
    const filterFn = React.useCallback(
        (a: Appointment) => {
            if (minimal) {
                // No modo de criação: só mostra ativos que ainda não terminaram
                if (a.status !== 'scheduled' && a.status !== 'ongoing')
                    return false;
                return new Date(a.end_at).getTime() >= getNow().getTime();
            }
            if (dayFilter === 'todos') return true;
            if (dayFilter === 'ativos')
                return a.status === 'scheduled' || a.status === 'ongoing';
            if (dayFilter === 'cancelados') return a.status === 'canceled';
            return true;
        },
        [dayFilter, minimal],
    );

    const outerStyle: React.CSSProperties = minimal
        ? {
              marginTop: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              // Garantir área rolável suficiente para vários minicards
              maxHeight: 'calc(100vh - 320px)',
              overflow: 'hidden',
          }
        : {
              marginTop: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              maxHeight: 'calc(100vh - 360px)',
              overflow: 'visible',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              background: 'var(--card-bg)',
          };

    return (
        <div style={outerStyle}>
            {!minimal && (
                <div
                    style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        color: 'var(--color-text)',
                        padding: '10px 14px',
                        background: 'linear-gradient(#ffffff,#f8fafc)',
                        borderBottom: '1px solid var(--color-border)',
                    }}
                >
                    <strong style={{ fontSize: 18 }}>
                        Compromissos do dia
                    </strong>
                    <div
                        style={{
                            display: 'flex',
                            gap: 8,
                            alignItems: 'center',
                        }}
                    >
                        <select
                            value={dayFilter}
                            onChange={e =>
                                onChangeFilter(e.target.value as DayFilter)
                            }
                            style={{
                                padding: '8px 12px',
                                fontSize: 15,
                                fontWeight: 600,
                                border: '1px solid var(--color-border)',
                                borderRadius: 6,
                                background: 'var(--color-bg)',
                                cursor: 'pointer',
                            }}
                            title='Filtrar por status'
                        >
                            <option value='todos'>
                                Todos ({appointments.length})
                            </option>
                            <option value='ativos'>
                                Ativos (
                                {
                                    appointments.filter(
                                        a =>
                                            a.status === 'scheduled' ||
                                            a.status === 'ongoing',
                                    ).length
                                }
                                )
                            </option>
                            <option value='cancelados'>
                                Cancelados (
                                {
                                    appointments.filter(
                                        a => a.status === 'canceled',
                                    ).length
                                }
                                )
                            </option>
                        </select>
                        {loading && (
                            <span style={{ fontSize: 13, color: '#6b7280' }}>
                                carregando…
                            </span>
                        )}
                    </div>
                </div>
            )}
            <div
                style={{
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    padding: '10px 14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    flex: 1,
                    WebkitOverflowScrolling: 'touch',
                    overscrollBehavior: 'contain',
                    touchAction: 'pan-y',
                    maxHeight: '100%',
                    minHeight: 120,
                    width: '100%',
                    boxSizing: 'border-box',
                }}
                ref={listRef}
            >
                {minimal && (
                    <>
                        <div
                            style={{
                                borderTop: '1px solid var(--color-border)',
                                margin: '4px 0 8px',
                            }}
                        />
                        <div
                            style={{
                                fontWeight: 700,
                                fontSize: 19,
                                color: 'var(--color-text)',
                                padding: '0 2px 4px',
                            }}
                        >
                            Compromissos do dia
                        </div>
                    </>
                )}
                {!minimal && (
                    <div
                        style={{
                            fontSize: 13,
                            color: '#6b7280',
                            fontWeight: 700,
                            letterSpacing: 0.2,
                        }}
                    >
                        {sectionDateTitle}
                    </div>
                )}
                <ClientDayList<Appointment>
                    appointments={appointments}
                    filterFn={filterFn}
                    sortBy={(a, b) =>
                        new Date(a.start_at).getTime() -
                        new Date(b.start_at).getTime()
                    }
                    timeSize='md'
                    timeOrder='start-top'
                    cardSize='md'
                    cardContainerStyle={{
                        minWidth: 0,
                        width: '100%',
                        maxWidth: 'min(704px, 94%)',
                    }}
                    getCardProps={appt => ({
                        showEditAction: false,
                        style: { padding: '6px 8px' },
                        highlight:
                            highlightId === appt.id ||
                            conflictHighlightIds.includes(appt.id),
                        selected: currentEditId === appt.id,
                        editingActive: editingHighlightId === appt.id,
                        pulse:
                            editingHighlightId === appt.id &&
                            currentEditId === appt.id,
                    })}
                    onResolvePending={appt => {
                        openPendingActionsForAppointment(
                            appt,
                            finalizeRequestContext,
                        );
                    }}
                    onUseTime={onUseTime}
                    onEdit={onEdit}
                    onCancel={onCancel}
                    onFinalize={onFinalize}
                    finalizeRequestContext={finalizeRequestContext}
                    onDetails={onDetails}
                    emptyPlaceholder={
                        !loading ? (
                            <div style={{ color: '#6b7280', fontSize: 13 }}>
                                Nenhum compromisso neste filtro.
                            </div>
                        ) : null
                    }
                />
            </div>
        </div>
    );
};

export default QuickScheduleDayList;
