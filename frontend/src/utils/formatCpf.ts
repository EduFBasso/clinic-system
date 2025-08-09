// Função utilitária para formatar CPF progressivamente
export function formatCpf(cpf: string): string {
    // Remove tudo que não é número
    cpf = cpf.replace(/\D/g, '');
    // Aplica máscara conforme o tamanho
    if (cpf.length <= 3) return cpf;
    if (cpf.length <= 6) return cpf.replace(/(\d{3})(\d+)/, '$1.$2');
    if (cpf.length <= 9) return cpf.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3');
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
}

// Função utilitária para formatar CEP progressivamente
export function formatCep(cep: string): string {
    cep = cep.replace(/\D/g, '');
    if (cep.length <= 5) return cep;
    return cep.replace(/(\d{5})(\d{0,3})/, '$1-$2');
}
