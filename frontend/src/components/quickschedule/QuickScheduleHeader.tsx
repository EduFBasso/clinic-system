import React from 'react';
import { FaTimes } from 'react-icons/fa';

export interface QuickScheduleHeaderProps {
    clientFullName: string;
    isEditing?: boolean;
    subtitle?: string;
    highlightName?: boolean;
    conflictAlert?: {
        label: string;
        message: string;
    } | null;
    onClose?: () => void;
}

export const QuickScheduleHeader: React.FC<QuickScheduleHeaderProps> = ({
    clientFullName,
    isEditing = false,
    subtitle,
    highlightName = false,
    conflictAlert = null,
    onClose,
}) => {
    const parts = clientFullName.trim().split(' ');
    const firstName = parts[0] ?? clientFullName;
    const lastName = parts.slice(1).join(' ');
    const stopCloseEvent = React.useCallback(
        (
            e:
                | React.MouseEvent<HTMLButtonElement>
                | React.PointerEvent<HTMLButtonElement>,
        ) => {
            e.preventDefault();
            e.stopPropagation();
        },
        [],
    );
    const handleCloseClick = React.useCallback(
        (e: React.MouseEvent<HTMLButtonElement>) => {
            stopCloseEvent(e);
            onClose?.();
        },
        [onClose, stopCloseEvent],
    );

    return (
        <div
            style={{
                position: 'sticky',
                top: 0,
                zIndex: 900,
                background: 'var(--color-bg)',
                borderBottom: '1px solid var(--color-border)',
                paddingTop: 'env(safe-area-inset-top, 0px)',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    gap: 8,
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: conflictAlert ? 8 : 2,
                        minWidth: 0,
                    }}
                >
                    <h2
                        style={{
                            margin: 0,
                            fontSize: conflictAlert ? 21 : 19,
                            fontWeight: 800,
                            color: '#111827',
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'inline-flex',
                            alignItems: 'center',
                            alignSelf: 'flex-start',
                            borderRadius: 10,
                            padding: highlightName ? '4px 8px' : 0,
                            background: highlightName
                                ? 'linear-gradient(180deg, rgba(248,250,252,0.98), rgba(241,245,249,0.96))'
                                : 'transparent',
                            boxShadow: highlightName
                                ? '0 0 0 1px rgba(148,163,184,0.28)'
                                : 'none',
                        }}
                        title={clientFullName}
                    >
                        {firstName}
                        {lastName && (
                            <span className='monthly-title-lastname'>
                                {' '}
                                {lastName}
                            </span>
                        )}
                    </h2>
                    {!conflictAlert && (
                        <span
                            style={{
                                fontSize: 13,
                                fontWeight: 600,
                                letterSpacing: subtitle ? 0.1 : 0.4,
                                textTransform: subtitle ? 'none' : 'uppercase',
                                color: 'var(--color-primary)',
                            }}
                        >
                            {subtitle ||
                                (isEditing
                                    ? 'Editar compromisso'
                                    : 'Novo compromisso')}
                        </span>
                    )}
                    {conflictAlert && (
                        <div
                            style={{
                                display: 'grid',
                                gap: 6,
                                padding: '10px 12px',
                                borderRadius: 14,
                                border: '1px solid rgba(239,68,68,0.22)',
                                borderLeft: '4px solid #dc2626',
                                background:
                                    'linear-gradient(180deg, rgba(254,242,242,0.98), rgba(255,247,237,0.96))',
                                boxShadow: '0 8px 18px rgba(127,29,29,0.08)',
                                maxWidth: 'min(100%, 560px)',
                            }}
                        >
                            <span
                                style={{
                                    fontSize: 12,
                                    fontWeight: 800,
                                    letterSpacing: 0.45,
                                    textTransform: 'uppercase',
                                    color: '#b91c1c',
                                }}
                            >
                                {conflictAlert.label}
                            </span>
                            <span
                                style={{
                                    fontSize: 15,
                                    lineHeight: 1.35,
                                    fontWeight: 600,
                                    color: '#7f1d1d',
                                }}
                            >
                                {conflictAlert.message}
                            </span>
                        </div>
                    )}
                </div>
                <button
                    type='button'
                    aria-label='Fechar'
                    onMouseDown={stopCloseEvent}
                    onPointerDown={stopCloseEvent}
                    onClick={handleCloseClick}
                    style={{
                        flexShrink: 0,
                        width: 36,
                        height: 36,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                        color: 'var(--color-heading)',
                        fontSize: 20,
                    }}
                >
                    <FaTimes />
                </button>
            </div>
        </div>
    );
};

export default QuickScheduleHeader;
