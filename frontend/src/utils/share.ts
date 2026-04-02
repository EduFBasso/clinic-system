export interface ShareOptions {
    text: string;
    phoneE164?: string; // digits only, with country code (e.g. 55XXXXXXXXXXX)
}

function normalizePhoneDigits(phone?: string): string | undefined {
    if (!phone) return undefined;
    const digits = String(phone).replace(/\D+/g, '');
    if (!digits) return undefined;
    // Accept 10-15 digits
    if (digits.length < 10 || digits.length > 15) return undefined;
    return digits;
}

function toWaLink(text: string, phoneE164?: string): string {
    const encoded = encodeURIComponent(text);
    const digits = normalizePhoneDigits(phoneE164);
    // Prefer api.whatsapp.com which tends to work better on mobile and desktop
    if (digits) {
        return `https://api.whatsapp.com/send?phone=${digits}&text=${encoded}`;
    }
    return `https://api.whatsapp.com/send?text=${encoded}`;
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
