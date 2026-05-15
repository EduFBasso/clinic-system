import React from 'react';

export type ClientCardStyleInput = {
    isOngoing: boolean;
    selected?: boolean;
    pressed: boolean;
    isScheduled: boolean;
    isPending?: boolean; // novo: aplicar tema cinza discreto quando pendente
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
    isPending,
}: ClientCardStyleInput): ClientCardStyle {
    // Paleta base (variáveis do CSS)
    const valueColor = 'var(--color-text)';
    const primaryColor = 'var(--color-primary)';
    const ongoingColor = 'var(--color-ongoing)';
    const ongoingBg = 'var(--color-ongoing-bg)';
    const cardBg = 'var(--card-bg)';

    // Definição de cores de label/ícone por estado
    const pendingColor = 'var(--color-pending)';
    const pendingBg = 'var(--color-pending-bg)';
    const labelColor = isOngoing
        ? ongoingColor
        : isPending
        ? pendingColor
        : primaryColor;
    const iconColor = isOngoing
        ? ongoingColor
        : isPending
        ? pendingColor
        : primaryColor;

    // Fundo e borda (padronização solicitada):
    // - Pending e Ongoing: sempre exibem borda sólida 1px na cor de estado (ongoingColor para ongoing, pendingColor para pending).
    // - Quando selecionados (pending ou ongoing): borda 2px mesma cor (não muda cor ao selecionar, apenas engrossa).
    // - Outros estados: borda somente se selecionado (1px primary) para consistência visual.
    // - Removida borda tracejada de pendente.
    const baseStateColor = isOngoing
        ? ongoingColor
        : isPending
        ? pendingColor
        : primaryColor;
    const showStateBorder = isOngoing || isPending;
    const borderWidth = showStateBorder ? (selected ? 2 : 1) : selected ? 1 : 0;
    const borderColor = showStateBorder ? baseStateColor : primaryColor;

    const containerStyle: React.CSSProperties = {
        position: 'relative',
        cursor: 'pointer',
        userSelect: 'none',
        // Prioridades de fundo:
        // 1. Em andamento
        // 2. Pendente (cinza claro discreto — NÃO deve sobrescrever selected azul se selecionado explicitamente)
        // 3. Selecionado padrão
        // 4. Card padrão
        background: isOngoing
            ? ongoingBg
            : isPending
            ? pendingBg
            : selected
            ? undefined
            : cardBg,
        border:
            borderWidth > 0
                ? `${borderWidth}px solid ${borderColor}`
                : undefined,
        boxShadow: selected && showStateBorder ? 'none' : undefined,
        transform: pressed ? 'scale(0.995)' : 'scale(1)',
        transition:
            'background 0.3s ease, border 0.2s ease, box-shadow 0.35s ease, transform 0.07s ease, color 0.3s ease, fill 0.3s ease',
    };

    // Separador entre dados pessoais e agenda
    const separatorColor = labelColor;
    const separatorOpacity = isOngoing ? 0.6 : isPending ? 0.55 : 0.5;

    return {
        containerStyle,
        labelColor,
        iconColor,
        valueColor,
        separatorColor,
        separatorOpacity,
    };
}
