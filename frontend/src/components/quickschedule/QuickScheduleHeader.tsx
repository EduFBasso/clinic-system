import React from 'react';
import { FaTimes } from 'react-icons/fa';

export interface QuickScheduleHeaderProps {
    clientFullName: string;
    onClose?: () => void;
}

export const QuickScheduleHeader: React.FC<QuickScheduleHeaderProps> = ({
    clientFullName,
    onClose,
}) => {
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
                    padding: '8px 0',
                    gap: 12,
                    flexWrap: 'wrap',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h2
                        style={{
                            margin: 0,
                            fontSize: 22,
                            fontWeight: 800,
                            color: '#111827',
                        }}
                        title={clientFullName}
                    >
                        {clientFullName}
                    </h2>
                    <span
                        aria-hidden
                        title='Novo agendamento'
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 22,
                            height: 22,
                            borderRadius: 999,
                            background: '#059669',
                            color: '#fff',
                            fontWeight: 900,
                            lineHeight: 1,
                        }}
                    >
                        +
                    </span>
                </div>
                <button
                    type='button'
                    aria-label='Fechar'
                    onClick={onClose}
                    style={{
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
