import React from 'react';

export type ClientCardStyleInput = {
    isOngoing: boolean;
    selected?: boolean;
    pressed: boolean;
    isScheduled: boolean;
};

export type ClientCardStyle = {
    containerStyle: React.CSSProperties;
    labelColor: string;
    iconColor: string;
    valueColor: string;
    separatorColor: string;
    separatorOpacity: number;
};

// Centraliza a lógica visual do ClientCard (cores e container),
// mantendo as decisões de UX atuais:
// - Durante o atendimento, o cartão permanece branco; seleção apenas engrossa a borda
// - Fora do atendimento, a seleção azul (classe CSS) continua valendo
export function useClientCardStyle({
    isOngoing,
    selected,
    pressed,
}: ClientCardStyleInput): ClientCardStyle {
    // Paleta base (variáveis do CSS)
    const valueColor = 'var(--color-text)';
    const primaryColor = 'var(--color-primary)';
    const ongoingColor = 'var(--color-ongoing)';
    const ongoingBg = 'var(--color-ongoing-bg)';
    const cardBg = 'var(--card-bg)';

    // Definição de cores de label/ícone por estado
    const labelColor = isOngoing ? ongoingColor : primaryColor;
    const iconColor = isOngoing ? ongoingColor : primaryColor;

    // Fundo e borda
    // - Em atendimento: fundo bege/laranja claro e borda na cor laranja escuro
    // - Seleção durante atendimento: apenas engrossa a borda (não aplica fill azul)
    // - Fora do atendimento: seleção (fill azul) fica a cargo da classe CSS selecionada
    const baseBorderWidth = isOngoing ? 1 : 1;
    const borderWidth =
        isOngoing && selected ? (pressed ? 3 : 3) : baseBorderWidth;
    const borderColor = isOngoing ? ongoingColor : 'var(--color-border)';

    const containerStyle: React.CSSProperties = {
        position: 'relative',
        cursor: 'pointer',
        userSelect: 'none',
        // Em atendimento: usar fundo bege/laranja claro e suprimir fill azul da seleção
        background: isOngoing ? ongoingBg : selected ? undefined : cardBg,
        border: isOngoing
            ? `${borderWidth}px solid ${borderColor}`
            : selected
            ? undefined
            : `${borderWidth}px solid ${borderColor}`,
        boxShadow: selected && isOngoing ? 'none' : undefined,
        transform: pressed ? 'scale(0.995)' : 'scale(1)',
        transition:
            'background 0.3s, border 0.25s, box-shadow 0.4s, transform 0.07s',
    };

    // Separador entre dados pessoais e agenda
    const separatorColor = labelColor;
    const separatorOpacity = isOngoing ? 0.6 : 0.5; // um pouco mais forte durante atendimento

    return {
        containerStyle,
        labelColor,
        iconColor,
        valueColor,
        separatorColor,
        separatorOpacity,
    };
}
