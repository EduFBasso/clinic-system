import React from 'react';
import { FaCalendarAlt } from 'react-icons/fa';

export interface QuickScheduleHeaderProps {
    isEdit: boolean;
    clientFullName: string;
    subtitleAgenda: string;
    onToggleDatePicker: () => void;
}

export const QuickScheduleHeader: React.FC<QuickScheduleHeaderProps> = ({
    isEdit,
    clientFullName,
    subtitleAgenda,
    onToggleDatePicker,
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
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                    flexWrap: 'wrap',
                    paddingBottom: 8,
                }}
            >
                <h2
                    style={{
                        margin: '0 0 4px 0',
                        fontSize: 28,
                        fontWeight: 800,
                        color: '#111827',
                    }}
                >
                    {isEdit ? 'Editar compromisso' : 'Agendar compromisso'}
                </h2>
            </div>
            <div style={{ color: '#374151', paddingBottom: 8 }}>
                <div style={{ marginBottom: 4 }}>
                    <strong>Nome:</strong> {clientFullName}
                </div>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                    }}
                >
                    <span style={{ whiteSpace: 'nowrap' }}>
                        <strong>Agenda:</strong> {subtitleAgenda}
                    </span>
                    <button
                        type='button'
                        onClick={onToggleDatePicker}
                        title='Selecionar dia'
                        style={{
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            padding: 4,
                        }}
                    >
                        <FaCalendarAlt color='#2563eb' />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuickScheduleHeader;
