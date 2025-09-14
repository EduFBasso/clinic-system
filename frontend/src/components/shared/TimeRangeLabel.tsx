import React from 'react';

interface TimeRangeLabelProps {
    start: Date | string;
    end: Date | string;
    format?: 'arrow' | 'dash';
    size?: 'sm' | 'md' | 'lg';
    boldEndArrow?: boolean;
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
        fontWeight: 600,
        ...style,
    };
    const sep =
        format === 'arrow' ? (
            boldEndArrow ? (
                <span style={{ fontWeight: 700 }}>→</span>
            ) : (
                '→'
            )
        ) : (
            '–'
        );
    return (
        <div className={className} style={baseStyle}>
            {fmt(s)}
            <br /> {sep} {fmt(e)}
        </div>
    );
};

export default TimeRangeLabel;
