// Helper to format BRL currency consistently
export function formatBRL(value: number): string {
    try {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2,
        }).format(value);
    } catch {
        // Fallback simple formatting
        return `R$ ${value.toFixed(2).replace('.', ',')}`;
    }
}

export type ChargeItem = {
    id?: string;
    label: string;
    price: number; // unit price in BRL
    qty?: number; // defaults to 1
};

export interface BuildChargeMessageArgs {
    clientName?: string;
    professionalName?: string;
    professionalTitle?: string;
    addressLine?: string;
    appointmentWhenLine?: string; // e.g., "Hoje 14:00" ou data formatada
    items: ChargeItem[];
    notes?: string;
}

export function buildChargeMessage(args: BuildChargeMessageArgs): {
    text: string;
    total: number;
} {
    const {
        clientName,
        professionalName,
        professionalTitle,
        addressLine,
        appointmentWhenLine,
        items,
        notes,
    } = args;
    const safeItems = (items || []).filter(i => i && i.label);
    const lines: string[] = [];
    if (clientName) {
        lines.push(`Olá, ${clientName}!`);
    } else {
        lines.push('Olá!');
    }
    lines.push('Segue o resumo do atendimento:');
    if (appointmentWhenLine) {
        lines.push(`• Quando: ${appointmentWhenLine}`);
    }
    if (addressLine) {
        lines.push(`• Local: ${addressLine}`);
    }
    if (safeItems.length > 0) {
        lines.push('');
        lines.push('Itens:');
        for (const it of safeItems) {
            const qty = typeof it.qty === 'number' && it.qty > 0 ? it.qty : 1;
            const lineTotal = it.price * qty;
            const suffix = qty > 1 ? ` x${qty}` : '';
            lines.push(`- ${it.label}${suffix}: ${formatBRL(lineTotal)}`);
        }
    }
    const total = safeItems.reduce(
        (acc, it) => acc + (it.price || 0) * (it.qty || 1),
        0,
    );
    lines.push('');
    lines.push(`Total: ${formatBRL(total)}`);
    if (notes && notes.trim()) {
        lines.push('');
        lines.push(`Obs.: ${notes.trim()}`);
    }
    if (professionalName || professionalTitle) {
        lines.push('');
        const profLine = [professionalName, professionalTitle]
            .filter(Boolean)
            .join(' — ');
        if (profLine) lines.push(profLine);
    }
    const text = lines.join('\n');
    return { text, total };
}

// === Orçamento (Budget) ===
export interface BuildBudgetMessageArgs {
    clientName?: string;
    professionalName?: string;
    professionalTitle?: string;
    items: ChargeItem[];
    notes?: string;
    // Orçamento específicos
    validUntil?: string; // e.g., 15/10/2025 ou ISO curto; exibimos como texto
    discountAmount?: number; // desconto absoluto em BRL
    discountPercent?: number; // desconto percentual (0..100)
    paymentInstructions?: string; // ex.: PIX: chave xxxxx; condições
}

export function buildBudgetMessage(args: BuildBudgetMessageArgs): {
    text: string;
    subtotal: number;
    discount: number;
    total: number;
} {
    const {
        clientName,
        professionalName,
        professionalTitle,
        items,
        notes,
        validUntil,
        discountAmount,
        discountPercent,
        paymentInstructions,
    } = args;

    const safeItems = (items || []).filter(i => i && i.label);
    const subtotal = safeItems.reduce(
        (acc, it) => acc + (it.price || 0) * (it.qty || 1),
        0,
    );
    let discountAbs = 0;
    if (typeof discountAmount === 'number' && discountAmount > 0) {
        discountAbs += discountAmount;
    }
    if (
        typeof discountPercent === 'number' &&
        discountPercent > 0 &&
        discountPercent <= 100
    ) {
        discountAbs += (subtotal * discountPercent) / 100;
    }
    if (discountAbs > subtotal) discountAbs = subtotal;
    const total = Math.max(0, subtotal - discountAbs);

    const lines: string[] = [];
    lines.push('Orçamento');
    if (clientName && clientName.trim()) {
        lines.push(`Olá, ${clientName}!`);
    }
    lines.push('Segue seu orçamento:');
    if (validUntil && validUntil.trim()) {
        lines.push(`• Validade: ${validUntil.trim()}`);
    }
    if (safeItems.length > 0) {
        lines.push('');
        lines.push('Itens:');
        for (const it of safeItems) {
            const qty = typeof it.qty === 'number' && it.qty > 0 ? it.qty : 1;
            const unit = formatBRL(it.price || 0);
            const lineTotal = (it.price || 0) * qty;
            const suffix = qty > 1 ? ` x${qty}` : '';
            lines.push(
                `- ${it.label}${suffix} (${unit}/un): ${formatBRL(lineTotal)}`,
            );
        }
    }
    lines.push('');
    lines.push(`Subtotal: ${formatBRL(subtotal)}`);
    if (discountAbs > 0) {
        // Exibir percent se houver
        const parts: string[] = [formatBRL(discountAbs)];
        if (typeof discountPercent === 'number' && discountPercent > 0) {
            parts.push(`(${discountPercent}%`);
            // fecha parêntese se não veio amount puro
            parts[parts.length - 1] = parts[parts.length - 1] + ')';
        }
        lines.push(`Desconto: ${parts.join(' ')}`);
    }
    lines.push(`Total: ${formatBRL(total)}`);
    if (paymentInstructions && paymentInstructions.trim()) {
        lines.push('');
        lines.push('Pagamento:');
        for (const ln of paymentInstructions.split('\n')) {
            const t = ln.trim();
            if (t) lines.push(`• ${t}`);
        }
    }
    if (notes && notes.trim()) {
        lines.push('');
        lines.push(`Obs.: ${notes.trim()}`);
    }
    if (professionalName || professionalTitle) {
        lines.push('');
        const profLine = [professionalName, professionalTitle]
            .filter(Boolean)
            .join(' — ');
        if (profLine) lines.push(profLine);
    }
    const text = lines.join('\n');
    return { text, subtotal, discount: discountAbs, total };
}
