// Função utilitária para formatar CPF progressivamente
export function formatCpf(cpf: string): string {
    // Remove tudo que não é número e limita a 11 dígitos
    cpf = cpf.replace(/\D/g, '').slice(0, 11);
    // Aplica máscara conforme o tamanho
    if (cpf.length <= 3) return cpf;
    if (cpf.length <= 6) return cpf.replace(/(\d{3})(\d+)/, '$1.$2');
    if (cpf.length <= 9) return cpf.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3');
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
}

// Função utilitária para formatar CNPJ progressivamente: 00.000.000/0000-00
export function formatCnpj(cnpj: string): string {
    // Remove tudo que não é número e limita a 14 dígitos
    cnpj = cnpj.replace(/\D/g, '').slice(0, 14);
    if (cnpj.length <= 2) return cnpj;
    if (cnpj.length <= 5) return cnpj.replace(/(\d{2})(\d+)/, '$1.$2');
    if (cnpj.length <= 8)
        return cnpj.replace(/(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
    if (cnpj.length <= 12)
        return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3/$4');
    return cnpj.replace(
        /(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/,
        '$1.$2.$3/$4-$5',
    );
}

// Função utilitária para formatar RG progressivamente: 00.000.000-0
export function formatRg(rg: string): string {
    const cleaned = rg.replace(/\D/g, '');
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 5) return cleaned.replace(/(\d{2})(\d+)/, '$1.$2');
    if (cleaned.length <= 8)
        return cleaned.replace(/(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{0,1})/, '$1.$2.$3-$4');
}

// Função utilitária para formatar CEP progressivamente
export function formatCep(cep: string): string {
    cep = cep.replace(/\D/g, '');
    if (cep.length <= 5) return cep;
    return cep.replace(/(\d{5})(\d{0,3})/, '$1-$2');
}
