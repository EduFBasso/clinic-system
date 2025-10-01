import React from 'react';

interface TimeRangeLabelProps {
    start: Date | string;
    end: Date | string;
    format?: 'arrow' | 'dash';
    size?: 'sm' | 'md' | 'lg';
    boldEndArrow?: boolean;
    // Controls which value is on the first line
    order?: 'start-top' | 'end-top';
    className?: string;
    style?: React.CSSProperties;
}

function fmt(d: Date) {
    return d.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

export const TimeRangeLabel: React.FC<TimeRangeLabelProps> = ({
    start,
    end,
    format = 'arrow',
    size = 'md',
    boldEndArrow = true,
    order = 'start-top',
    className,
    style,
}) => {
    const s = typeof start === 'string' ? new Date(start) : start;
    const e = typeof end === 'string' ? new Date(end) : end;
    const fontSize = size === 'lg' ? 14 : size === 'sm' ? 11 : 12;
    const baseStyle: React.CSSProperties = {
        fontSize,
        lineHeight: 1.25,
        textAlign: 'right',
        fontWeight: 'var(--card-time-weight)',
        ...style,
    };
    const sep =
        format === 'arrow' ? (
            boldEndArrow ? (
                <span style={{ fontWeight: 'var(--card-time-weight)' }}>→</span>
            ) : (
                '→'
            )
        ) : (
            '–'
        );
    const top =
        order === 'end-top' ? (
            <>
                {sep} {fmt(e)}
            </>
        ) : (
            <>{fmt(s)}</>
        );
    const bottom =
        order === 'end-top' ? (
            <>{fmt(s)}</>
        ) : (
            <>
                {sep} {fmt(e)}
            </>
        );
    return (
        <div className={className} style={baseStyle}>
            {top}
            <br /> {bottom}
        </div>
    );
};

export default TimeRangeLabel;
