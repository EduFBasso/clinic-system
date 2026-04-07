import React from 'react';
import { FaArrowLeft, FaArrowRight, FaCalendarAlt } from 'react-icons/fa';

export interface DateControlsHeaderProps {
    currentDate: Date;
    label: string;
    onPrev: () => void;
    onNext: () => void;
    onToday: () => void;
    onOpenPicker: () => void;
    prevDisabled?: boolean;
}

export const DateControlsHeader: React.FC<DateControlsHeaderProps> = ({
    currentDate,
    label,
    onPrev,
    onNext,
    onToday,
    onOpenPicker,
    prevDisabled = false,
}) => {
    const isToday = (() => {
        const d = new Date(currentDate);
        const t = new Date();
        return (
            d.getFullYear() === t.getFullYear() &&
            d.getMonth() === t.getMonth() &&
            d.getDate() === t.getDate()
        );
    })();

    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                alignItems: 'center',
                gap: 8,
                width: '100%',
            }}
        >
            {/* Left: Hoje */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                    type='button'
                    onClick={onToday}
                    aria-label='Ir para hoje'
                    aria-pressed={isToday}
                    style={{
                        border: 'none',
                        background: 'var(--color-success-dark)',
                        color: '#fff',
                        padding: '6px 10px',
                        borderRadius: 6,
                        cursor: 'pointer',
                    }}
                >
                    Hoje
                </button>
            </div>

            {/* Center: Ícone do datepicker + setas e rótulo (uma linha) */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    minWidth: 0,
                }}
            >
                {/* Ícone entre Hoje e seletor de data */}
                <button
                    type='button'
                    onClick={onOpenPicker}
                    aria-label='Abrir seletor de data'
                    title='Selecionar dia'
                    style={{
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg)',
                        padding: 6,
                        borderRadius: 6,
                        cursor: 'pointer',
                        flex: '0 0 auto',
                    }}
                >
                    <FaCalendarAlt />
                </button>

                <button
                    type='button'
                    onClick={prevDisabled ? undefined : onPrev}
                    aria-label='Anterior'
                    disabled={prevDisabled}
                    style={{
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg)',
                        padding: 6,
                        borderRadius: 6,
                        cursor: prevDisabled ? 'not-allowed' : 'pointer',
                        flex: '0 0 auto',
                        opacity: prevDisabled ? 0.35 : 1,
                    }}
                >
                    <FaArrowLeft />
                </button>
                <span
                    role='heading'
                    aria-level={2}
                    style={{
                        fontWeight: 700,
                        color: 'var(--color-heading)',
                        whiteSpace: 'nowrap',
                        minWidth: 0,
                    }}
                >
                    {label}
                </span>
                <button
                    type='button'
                    onClick={onNext}
                    aria-label='Próximo'
                    style={{
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg)',
                        padding: 6,
                        borderRadius: 6,
                        cursor: 'pointer',
                        flex: '0 0 auto',
                    }}
                >
                    <FaArrowRight />
                </button>
            </div>

            {/* Right spacer for symmetry */}
            <div aria-hidden />
        </div>
    );
};

export default DateControlsHeader;
