export interface ShareOptions {
    text: string;
    phoneE164?: string; // e.g., 55DDNNNNNNNNN (digits only)
}

function toWaLink(text: string, phoneE164?: string): string {
    const encoded = encodeURIComponent(text);
    if (phoneE164 && /^[0-9]{10,15}$/.test(phoneE164)) {
        return `https://wa.me/${phoneE164}?text=${encoded}`;
    }
    return `https://wa.me/?text=${encoded}`;
}

export async function shareText(
    opts: ShareOptions,
): Promise<'shared' | 'opened-wa' | 'copied'> {
    const { text, phoneE164 } = opts;
    // 1) Priorizar abrir WhatsApp (wa.me) diretamente
    try {
        const url = toWaLink(text, phoneE164);
        const win = window.open(url, '_blank', 'noopener,noreferrer');
        if (!win) {
            // Alguns bloqueadores impedem window.open; tenta navegação direta
            window.location.href = url;
        }
        return 'opened-wa';
    } catch {
        // ignore
    }
    // 2) Web Share API (quando disponível)
    try {
        const nav = navigator as Navigator & {
            share?: (data: ShareData) => Promise<void>;
        };
        if (nav.share) {
            await nav.share({ text });
            return 'shared';
        }
    } catch {
        // ignore
    }
    // 3) Fallback final: copiar para a área de transferência
    try {
        await navigator.clipboard.writeText(text);
        return 'copied';
    } catch {
        // Último recurso: selecionar e instruir o usuário manualmente
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
        } catch {
            /* noop */
        }
        document.body.removeChild(ta);
        return 'copied';
    }
}
