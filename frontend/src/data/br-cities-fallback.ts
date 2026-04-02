// Minimal fallback list of city names by UF, used if IBGE API is unavailable.
// Keep this lightweight; expand as needed.
export const BR_CITIES_FALLBACK: Record<string, string[]> = {
    SP: [
        'São Paulo',
        'Campinas',
        'Guarulhos',
        'Santo André',
        'São Bernardo do Campo',
        'São José dos Campos',
        'Ribeirão Preto',
        'Sorocaba',
        'Santos',
        'Jundiaí',
        'Piracicaba',
        'Bauru',
        'Mogi das Cruzes',
        'Osasco',
        'Limeira',
    ],
    RJ: [
        'Rio de Janeiro',
        'Niterói',
        'Duque de Caxias',
        'Nova Iguaçu',
        'Petrópolis',
    ],
    MG: ['Belo Horizonte', 'Uberlândia', 'Contagem', 'Juiz de Fora', 'Betim'],
    PR: ['Curitiba', 'Londrina', 'Maringá', 'Ponta Grossa', 'Cascavel'],
};
