/**
 * Converts DRF/DB error responses into human-readable Portuguese messages.
 */
export function parseApiError(errorData: unknown, status?: number): string {
    if (status === 401) return 'Sessão expirada. Faça login novamente.';

    if (typeof errorData === 'string') {
        const s = errorData;
        if (
            /UNIQUE constraint failed|duplicate key value|violates unique constraint|unique|já\s*cadastr/i.test(s)
        ) {
            if (/email/i.test(s)) return 'E-mail já existe.';
            if (/phone|telefone|register_client_phone|phone_digits/i.test(s))
                return 'Este telefone já cadastrado';
            return 'Registro duplicado: valor já existe.';
        }
        if (/credenciais|credentials|autentica/i.test(s))
            return 'Sessão expirada. Faça login novamente.';
        return s;
    }

    if (errorData && typeof errorData === 'object') {
        const obj = errorData as Record<string, unknown>;
        if (typeof obj.detail === 'string') {
            const d = obj.detail;
            if (
                /UNIQUE constraint failed|duplicate key value|violates unique constraint|unique|já\s*cadastr/i.test(d)
            ) {
                if (/email/i.test(d)) return 'E-mail já existe.';
                if (/phone|telefone|register_client_phone|phone_digits/i.test(d))
                    return 'Este telefone já cadastrado';
                return 'Registro duplicado: valor já existe.';
            }
            if (/credenciais|credentials|autentica/i.test(d))
                return 'Sessão expirada. Faça login novamente.';
            return d;
        }

        const messages: string[] = [];
        for (const [field, val] of Object.entries(obj)) {
            const label =
                field === 'email'       ? 'E-mail'    :
                field === 'phone'       ? 'Telefone'  :
                field === 'state'       ? 'Estado'    :
                field === 'city'        ? 'Cidade'    :
                field === 'postal_code' ? 'CEP'       :
                field === 'profession'  ? 'Profissão' :
                field.replace(/_/g, ' ');
            const toText = (v: unknown) =>
                Array.isArray(v) ? v.map(x => String(x)).join(', ') : String(v ?? '');
            const txt = toText(val);
            if (
                /já existe|exists|unique|duplicate|violates unique constraint|já\s*cadastr/i.test(txt)
            ) {
                if (field === 'phone' || /phone|telefone/i.test(txt)) {
                    messages.push('Este telefone já cadastrado');
                } else {
                    messages.push(`${label} já existe.`);
                }
            } else if (txt) {
                messages.push(`${label}: ${txt}`);
            }
        }
        if (messages.length) return messages.join(' ');
    }

    return 'Erro ao processar solicitação.';
}
