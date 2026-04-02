// Função utilitária para formatar CEP progressivamente
export function formatCep(cep: string): string {
    cep = cep.replace(/\D/g, '');
    if (cep.length <= 5) return cep;
    return cep.replace(/(\d{5})(\d{0,3})/, '$1-$2');
}
