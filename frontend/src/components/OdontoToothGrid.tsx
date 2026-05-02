import React from 'react';
import type { ToothItem } from '../pages/odontoArcadeHelpers';
import styles from '../styles/pages/OdontoArcadePage.module.css';

interface OdontoToothGridProps {
    orderedTeeth: ToothItem[];
    selectedToothId: number | null;
    suppressDateHighlights: boolean;
    activeDateToothIds: Set<number>;
    onToothClick: (toothId: number) => void;
}

export const OdontoToothGrid = React.memo(function OdontoToothGrid({
    orderedTeeth,
    selectedToothId,
    suppressDateHighlights,
    activeDateToothIds,
    onToothClick,
}: OdontoToothGridProps) {
    return (
        <svg
            className={styles.arcadeSvg}
            viewBox='0 0 760 390'
            role='img'
            aria-label='Mapa da arcada com 32 dentes'
        >
            <text x='24' y='24' className={styles.quadrantLabel}>
                Q1 - SUPERIOR DIREITO
            </text>
            <text x='386' y='24' className={styles.quadrantLabel}>
                Q2 - SUPERIOR ESQUERDO
            </text>
            <text x='24' y='220' className={styles.quadrantLabel}>
                Q4 - INFERIOR DIREITO
            </text>
            <text x='386' y='220' className={styles.quadrantLabel}>
                Q3 - INFERIOR ESQUERDO
            </text>
            <line
                x1='371'
                y1='34'
                x2='371'
                y2='376'
                className={styles.quadrantDivider}
            />
            {orderedTeeth.map((tooth, index) => {
                const row = Math.floor(index / 8);
                const col = index % 8;
                const x = 20 + col * 90;
                const lowerOffset = row >= 2 ? 32 : 0;
                const y = 40 + row * 82 + lowerOffset;
                const selected = selectedToothId === tooth.id;
                const inDateEvent =
                    !suppressDateHighlights && activeDateToothIds.has(tooth.id);

                return (
                    <g
                        key={tooth.id}
                        className={styles.toothGroup}
                        onClick={() => onToothClick(tooth.id)}
                        onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                onToothClick(tooth.id);
                            }
                        }}
                        role='button'
                        tabIndex={0}
                        aria-pressed={selected}
                        aria-label={`Dente ${tooth.international_number}`}
                    >
                        <rect
                            x={x}
                            y={y}
                            width='72'
                            height='62'
                            rx='10'
                            className={`${styles.toothRect} ${
                                selected
                                    ? styles.toothSelected
                                    : inDateEvent
                                      ? styles.toothInDateEvent
                                      : styles.toothEmpty
                            }`}
                        />
                        <text
                            x={x + 36}
                            y={y + 31}
                            className={`${styles.toothNumber} ${
                                selected || inDateEvent ? styles.toothNumberActive : ''
                            }`}
                        >
                            {tooth.international_number}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
});
