import { getActiveDrift } from './timeDrift';

// Retorna "agora" corrigido pelo drift entre relógio local e servidor.
// Em desenvolvimento/testes getActiveDrift() retorna 0, sem efeito colateral.
export function getNow(): Date {
    return new Date(Date.now() + getActiveDrift());
}
