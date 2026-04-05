import React from 'react';
import { FaTimes } from 'react-icons/fa';

export interface QuickScheduleHeaderProps {
    clientFullName: string;
    isEditing?: boolean;
    onClose?: () => void;
}

export const QuickScheduleHeader: React.FC<QuickScheduleHeaderProps> = ({
    clientFullName,
    isEditing = false,
    onClose,
}) => {
    const parts = clientFullName.trim().split(' ');
    const firstName = parts[0] ?? clientFullName;
    const lastName = parts.slice(1).join(' ');

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
                        gap: 2,
                        minWidth: 0,
                    }}
                >
                    <h2
                        style={{
                            margin: 0,
                            fontSize: 19,
                            fontWeight: 800,
                            color: '#111827',
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
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
                    <span
                        style={{
                            fontSize: 13,
                            fontWeight: 600,
                            letterSpacing: 0.4,
                            textTransform: 'uppercase',
                            color: isEditing ? '#2563eb' : '#059669',
                        }}
                    >
                        {isEditing ? 'Editar compromisso' : 'Novo compromisso'}
                    </span>
                </div>
                <button
                    type='button'
                    aria-label='Fechar'
                    onClick={onClose}
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
