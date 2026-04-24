# Agenda State Model

Este documento define a logica de estados do compromisso na Agenda.

O objetivo nao e apenas documentar comportamento. O objetivo principal e servir como mapa de estabilizacao da parte mais sensivel do sistema antes da introducao de novos recursos.

Este documento complementa:

- `frontend/docs/agenda-stabilization-map.md`
- `frontend/docs/agenda-stabilization-current-analysis.md`

## Objetivo

Formalizar:

- quais estados de compromisso existem
- quais condicoes sao apenas operacionais no tempo
- quais transicoes sao permitidas
- quais atributos podem ser alterados em cada fase
- qual deve ser a fronteira entre Agenda, atendimento e financeiro

## Premissas de negocio

Esta modelagem parte das seguintes decisoes:

1. Compromisso e atendimento nao sao a mesma coisa.
2. `ongoing` nao e estado persistido do compromisso; e uma condicao operacional do tempo.
3. `pending` e um estado transitorio de resolucao.
4. `done` e `canceled` sao estados terminais.
5. `pending` nunca volta para `scheduled`.
6. Se for necessario novo horario, deve existir um novo agendamento.
7. Cancelamento pode ocorrer sem passar por `pending`.
8. Conclusao passa por `pending` antes do fechamento definitivo.
9. Apos `pending`, nao se altera mais data ou horario.
10. Apos `done` ou `canceled`, o status nao muda mais.

## Conceitos

### 1. Scheduled

Compromisso programado e ainda valido como agendamento ativo.

Caracteristicas:

- pode ter data alterada
- pode ter horario alterado
- pode ser cancelado
- depende do tempo para entrar em condicao operacional de atendimento

### 2. Ongoing

Condicao operacional de tempo do compromisso.

Nao e estado persistido do compromisso.

Representa que:

- o horario atual entrou na janela prevista do atendimento
- o compromisso continua ativo operacionalmente
- ainda pode sofrer ajuste de data/hora futura conforme regra do projeto

Leitura importante:

- `ongoing` nao substitui o estado persistido do compromisso
- `ongoing` e derivado de tempo

### 3. Pending

Estado transitorio de resolucao.

Ele representa que o compromisso saiu da condicao ativa de agendamento e precisa ser resolvido definitivamente.

`pending` pode surgir em dois cenarios:

1. o tempo previsto terminou e o compromisso nao foi resolvido explicitamente
2. o atendimento foi encerrado antes do horario previsto e o usuario ainda precisa escolher a resolucao final

Leitura importante:

- `pending` nao e estado de reprogramacao
- `pending` nao volta a ser compromisso futuro
- `pending` nao permite alteracao de data/hora

### 4. Done

Estado terminal de compromisso concluido.

Caracteristicas:

- nao muda mais para outro status
- data e horario do compromisso nao mudam mais
- pode encaminhar para o financeiro
- o projeto permite alteracao de atributos financeiros ligados ao compromisso concluido

Leitura importante:

- o que pode mudar em `done` nao e o compromisso como agenda
- o que pode mudar sao dependencias permitidas do concluido, especialmente financeiras

### 5. Canceled

Estado terminal de compromisso cancelado.

Caracteristicas:

- nao muda mais para outro status
- nao volta a ser ativo
- nao permite nova programacao do mesmo compromisso

## Modelo de estado

### Estados persistidos do compromisso

- `scheduled`
- `pending`
- `done`
- `canceled`

### Estado nao persistido, apenas operacional

- `ongoing`

## Tabela de estados

| Estado | Natureza | Significado | Edita data/hora | Pode cancelar | Pode concluir | Pode voltar a futuro |
|---|---|---|---:|---:|---:|---:|
| `scheduled` | persistido | compromisso ativo programado | Sim | Sim | Indiretamente, via `pending` | Sim |
| `ongoing` | operacional | janela de atendimento em curso | Sim, conforme regra operacional atual | Sim | Indiretamente, via `pending` | Nao |
| `pending` | persistido transitorio | compromisso aguardando resolucao final | Nao | Sim | Sim | Nao |
| `done` | persistido terminal | compromisso concluido | Nao | Nao | Nao | Nao |
| `canceled` | persistido terminal | compromisso cancelado | Nao | Nao | Nao | Nao |

## Tabela de transicoes

### Transicoes permitidas

1. `scheduled -> ongoing`
2. `scheduled -> pending`
3. `scheduled -> canceled`
4. `ongoing -> pending`
5. `ongoing -> canceled`
6. `pending -> done`
7. `pending -> canceled`

### Transicoes proibidas

1. `pending -> scheduled`
2. `pending -> ongoing`
3. `done -> qualquer outro status`
4. `canceled -> qualquer outro status`

## Regras de transicao

### 1. Scheduled -> Ongoing

Nao e gravacao de novo status.

E apenas leitura operacional baseada em tempo:

- o horario atual entrou na janela do compromisso

### 2. Scheduled -> Pending

Ocorre quando o compromisso deixa de estar apenas programado e precisa de resolucao.

Exemplos:

- o tempo previsto terminou sem resolucao explicita
- o usuario encerrou o atendimento antes do horario planejado e agora precisa decidir a resolucao final

### 3. Scheduled -> Canceled

Permitido diretamente.

`canceled` nao depende de passar por `pending`.

Esse ponto e importante porque o usuario pode precisar cancelar antes ou durante a janela prevista.

### 4. Ongoing -> Pending

Ocorre quando o compromisso em execucao deixa de ser apenas uma janela ativa e passa a exigir resolucao final.

Regra confirmada:

- concluir antes do horario previsto nao vai direto para `done`
- primeiro entra em `pending`
- depois exige acao explicita do usuario para resolver em `done` ou `canceled`

### 5. Pending -> Done

O usuario resolve o compromisso como concluido.

Ao seguir para `done`:

- o compromisso se fecha definitivamente
- data/hora nao mudam mais
- pode haver encaminhamento para o financeiro para registrar servicos prestados e produtos vendidos

### 6. Pending -> Canceled

O usuario resolve o compromisso como cancelado.

Ao seguir para `canceled`:

- o compromisso se fecha definitivamente
- nao pode mais ser reutilizado

## Regras de edicao por estado

### Scheduled

Permitido:

- alterar data
- alterar horario
- cancelar
- ajustar atributos do agendamento conforme regra atual

### Ongoing

Condicao confirmada:

- o compromisso ativo pode ter data/hora alterada apos `now`, conforme regra implicita ja existente no projeto
- durante a janela de atendimento em curso, o horario ainda pode ser alterado dentro dessa logica operacional

Leitura importante:

- isso nao significa que `ongoing` e um novo status persistido
- significa apenas que o compromisso ainda esta na fase ativa do fluxo

### Pending

Nao permitido:

- alterar data
- alterar horario
- alterar atributos estruturais do compromisso
- voltar para agenda futura

Permitido:

- resolver o compromisso em `done`
- resolver o compromisso em `canceled`

### Done

Nao permitido:

- alterar status
- alterar data/hora do compromisso

Permitido:

- alterar atributos permitidos do concluido, especialmente dependencias financeiras

Leitura importante:

- `done` e estado solido
- o compromisso nao muda mais; apenas dependencias financeiras podem evoluir se o projeto permitir

### Canceled

Nao permitido:

- alterar status
- alterar data/hora
- reativar compromisso

## Regra temporal central

### Scheduled

Depende do tempo e continua programavel.

### Ongoing

E apenas uma interpretacao operacional do tempo atual sobre um compromisso ainda ativo.

### Pending

Marca a saida definitiva da fase programavel do compromisso.

Depois de `pending`, nao existe mais edicao de agenda para aquele compromisso.

## Relacao entre compromisso, atendimento e financeiro

### Compromisso

Objeto de agenda.

Serve para:

- programar horario
- reorganizar agenda do profissional
- decidir cancelamento ou conclusao

### Atendimento

Acao em processo.

Leitura de negocio:

- atendimento e a execucao real do trabalho
- ele pode terminar antes do horario planejado
- ele pode exigir resolucao explicita ao final

### Financeiro

Nao define a agenda.

Ele entra apos a resolucao do compromisso em `done`, para registrar:

- servicos prestados
- produtos vendidos
- valores vinculados ao compromisso concluido

## Impacto arquitetural esperado

## Backend

Esta modelagem aponta para um backend com estas responsabilidades:

1. `scheduled`, `pending`, `done` e `canceled` como estados persistidos do compromisso
2. `ongoing` como condicao operacional calculada
3. transicao para `pending` controlada no backend
4. resolucao de `pending` exigindo acao explicita do usuario
5. `done` e `canceled` como estados terminais definitivos

## Frontend

Esta modelagem aponta para um frontend mais simples:

1. nao inferir `pending` sozinho como regra principal
2. consumir o estado informado pelo backend
3. tratar `ongoing` apenas como condicao visual ou operacional
4. impedir edicao de data/hora a partir de `pending`
5. separar claramente agenda de resolucao e agenda de financeiro

## Regras que devem guiar a estabilizacao

1. `pending` nao pode ser usado como estado de reprogramacao
2. `pending` e transitorio, mas continua importante como estado de resolucao
3. `done` e `canceled` sao terminais e estaveis
4. novo horario exige novo agendamento
5. `ongoing` nao deve contaminar a persistencia do compromisso como novo status de dominio
6. a Agenda deve parar de depender de inferencia difusa no frontend para saber se um compromisso esta pendente

## Decisoes confirmadas

1. `pending -> scheduled` nao existe
2. `pending` nao altera data
3. `pending` nao altera horario
4. `pending` nao volta para futuro
5. `canceled` pode ocorrer sem passar por `pending`
6. `done` passa por `pending`
7. `done` e `canceled` nao mudam mais de status
8. `done` permite evolucao apenas de dependencias permitidas, especialmente financeiras
9. `ongoing` e condicao operacional do tempo, nao estado persistido
10. concluir antes do horario previsto entra em `pending` e exige resolucao explicita pelo usuario

## Uso deste documento

Este documento deve servir como referencia para:

1. estabilizar a Agenda
2. revisar backend antes de implementar a nova logica de estados
3. simplificar frontend depois que o backend assumir a fonte principal de verdade
4. avaliar qualquer novo recurso de Agenda sem quebrar a regra central do sistema

## Proximo passo recomendado

A partir deste documento, o proximo passo tecnico deve ser:

1. transformar esta maquina de estados em especificacao de backend
2. revisar endpoints e serializers do compromisso com base nessas transicoes
3. so depois ajustar o frontend para consumir a nova verdade de estado