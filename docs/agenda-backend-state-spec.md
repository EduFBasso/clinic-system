# Agenda Backend State Spec

Este documento traduz o modelo confirmado da Agenda para uma especificacao de backend.

O objetivo aqui nao e implementar ainda.

O objetivo e definir, antes de qualquer alteracao de codigo:

- quais estados o backend deve persistir
- quais condicoes continuam apenas operacionais
- quais endpoints e serializers serao impactados
- qual deve ser a ordem segura de migracao

Este documento parte de:

- `frontend/docs/agenda-state-model.md`
- `frontend/docs/agenda-stabilization-map.md`
- `frontend/docs/agenda-stabilization-current-analysis.md`

## Objetivo arquitetural

O backend deve virar a fonte principal de verdade para a logica de estado do compromisso.

Isso significa:

1. o frontend deixa de inferir `pending` como regra principal
2. o backend passa a controlar a transicao para `pending`
3. o frontend consome estados e payloads mais claros
4. a Agenda reduz dependencia de heuristicas locais baseadas em tempo e storage

## Modelo de estado confirmado

### Estados persistidos do compromisso

- `scheduled`
- `pending`
- `done`
- `canceled`

### Condicao operacional nao persistida

- `ongoing`

`ongoing` continua sendo calculado com base no tempo atual e na janela `start_at`/`end_at`.

Ele nao deve virar novo status persistido no banco.

## Semantica de cada estado

### `scheduled`

Compromisso ativo e programado.

Permite:

- alteracao de data
- alteracao de horario
- cancelamento

### `pending`

Compromisso que saiu da fase programavel e agora exige resolucao final.

Nao permite:

- alterar data
- alterar horario
- voltar a ser futuro

Permite apenas:

- resolver como `done`
- resolver como `canceled`

### `done`

Estado terminal de compromisso concluido.

Nao muda mais de status.

O que pode continuar mudando sao apenas dependencias permitidas do concluido, especialmente a parte financeira.

### `canceled`

Estado terminal de compromisso cancelado.

Nao muda mais de status.

## Regras temporais

## `ongoing`

`ongoing` deve ser tratado apenas como condicao operacional derivada.

Leitura sugerida:

- `is_ongoing = start_at <= now < end_at`

Essa condicao pode continuar sendo entregue ao frontend como campo derivado, mas nao deve ser persistida como status.

## Entrada em `pending`

`pending` pode surgir de duas formas:

1. o horario planejado terminou sem resolucao explicita
2. o atendimento foi encerrado antes do horario previsto e precisa de resolucao final pelo usuario

## Regras de transicao persistida

### Permitidas

1. `scheduled -> pending`
2. `scheduled -> canceled`
3. `pending -> done`
4. `pending -> canceled`

### Nao permitidas

1. `pending -> scheduled`
2. `done -> qualquer outro status`
3. `canceled -> qualquer outro status`

## Regra central de negocio

Se for necessario novo horario depois de `pending`, `done` ou `canceled`, o sistema deve criar um novo agendamento.

Nao deve reaproveitar o mesmo compromisso como retorno a `scheduled`.

## Implicacao no model `Appointment`

Hoje o backend usa:

- `scheduled`
- `done`
- `canceled`

Arquivo atual:

- `backend/apps/agenda/models.py`

O backend precisara incorporar `pending` ao `Appointment.Status`.

### Target state do model

Sugestao de enum:

```python
class Status(models.TextChoices):
    SCHEDULED = "scheduled", "Agendado"
    PENDING = "pending", "Pendente"
    DONE = "done", "Realizado"
    CANCELED = "canceled", "Cancelado"
```

## Campos adicionais

Pelo escopo confirmado ate aqui, nao existe exigencia de auditoria nova.

Portanto:

- `pending_at` nao e obrigatorio nesta fase
- nao e necessario criar trilha adicional so para saber quando entrou em `pending`

Decisao recomendada:

- nao adicionar novos campos de auditoria agora
- preservar o modelo o mais enxuto possivel durante a estabilizacao

## Semantica de `end_at`

Existe um ponto importante ja presente no backend atual: quando a finalizacao ocorre antes do horario previsto, o sistema hoje encurta `end_at` para `now`.

Essa logica pode continuar, mas com nova semantica:

- a acao nao fecha mais em `done` imediatamente
- a acao move o compromisso para `pending`
- `end_at` pode ser ajustado para refletir o fim real do atendimento, se isso continuar sendo desejado

Recomendacao para esta fase:

- manter a logica atual de ajuste de `end_at` quando o atendimento termina antes do previsto
- mudar apenas a transicao final de status para `pending` em vez de `done`

Isso reduz a superficie de mudanca.

## Implicacao em serializer

Arquivo atual principal:

- `backend/apps/agenda/serializers.py`

### Regras que precisam ser revistas

#### 1. Edicao geral do compromisso

Hoje a edicao geral aceita apenas compromissos `scheduled`.

Essa regra continua conceitualmente correta.

Nova leitura:

- so `scheduled` pode editar data/hora
- `pending`, `done` e `canceled` nao podem editar data/hora

#### 2. Bloqueio de novo agendamento quando existe pendencia

Hoje o backend bloqueia novo agendamento quando existe compromisso `scheduled` no passado.

Com a nova modelagem, a regra deve migrar para:

- bloquear novo agendamento quando existe compromisso `pending` para aquele cliente

Isso e importante porque a semantica de negocio deixa de depender de horario vencido em `scheduled` e passa a depender do estado persistido correto.

#### 3. Conflito de agenda

Hoje a deteccao de conflito exclui `done` e `canceled`.

Com a nova modelagem, precisa definir se `pending` ocupa agenda para conflito.

Recomendacao:

- `pending` nao deve bloquear nova agenda por conflito temporal

Motivo:

- ele nao e mais compromisso programavel
- ele e estado de resolucao

Leitura pratica:

- conflitos de horario devem considerar apenas `scheduled`

## Implicacao em endpoints

Arquivo atual principal:

- `backend/apps/agenda/views.py`

### 1. Listagem e filtros

Os filtros por `status` precisam passar a aceitar `pending` como valor persistido legitimo.

### 2. Endpoint de cancelamento

O cancelamento deve aceitar:

- `scheduled -> canceled`
- `pending -> canceled`

Deve continuar recusando:

- `done -> canceled`

### 3. Endpoint de conclusao

Aqui existe a maior mudanca conceitual.

Hoje `finalize` marca diretamente como `done`.

Pela logica confirmada do projeto, o backend deve mudar para:

- a acao de encerramento operacional leva para `pending`
- a resolucao final para `done` acontece em etapa posterior, ligada ao fluxo de servicos/produtos

## Recomendacao de desenho de endpoint

Existem duas opcoes.

### Opcao A. Reusar `finalize` com nova semantica

`POST /agenda/appointments/{id}/finalize/`

Nova semantica:

- se `scheduled`, move para `pending`
- se finalizado antes do horario previsto, pode ajustar `end_at`
- nao fecha mais diretamente como `done`

Vantagem:

- menos mudanca de frontend e rotas agora

Desvantagem:

- o nome `finalize` fica semanticamente menos preciso

### Opcao B. Separar encerramento operacional de conclusao final

Exemplo:

- `POST /agenda/appointments/{id}/close-window/` ou equivalente -> `scheduled` para `pending`
- `POST /agenda/appointments/{id}/done/` -> `pending` para `done`

Vantagem:

- semantica mais limpa

Desvantagem:

- muda mais o contrato agora

## Recomendacao para estabilizacao

Adotar a opcao A primeiro.

Motivo:

- mantem a superficie de mudanca menor
- reduz impacto imediato no frontend
- permite estabilizar a regra antes de renomear contratos

## Fluxo esperado no backend

### Fluxo 1. Agendamento normal

1. cria compromisso com `status=scheduled`
2. pode editar data/hora enquanto continuar `scheduled`
3. pode cancelar diretamente

### Fluxo 2. Horario chegou e compromisso venceu sem resolucao

1. backend deve promover para `pending`
2. frontend recebe `pending`
3. usuario resolve como `done` ou `canceled`

### Fluxo 3. Encerramento antes da hora prevista

1. usuario encerra o compromisso
2. backend pode ajustar `end_at` para o horario real
3. backend move para `pending`
4. usuario resolve explicitamente como `done` ou `canceled`

### Fluxo 4. Resolucao concluida

1. compromisso em `pending`
2. usuario confirma conclusao
3. backend move para `done`
4. fluxo segue para financeiro

### Fluxo 5. Resolucao cancelada

1. compromisso em `pending`
2. usuario cancela
3. backend move para `canceled`

## Como o backend deve promover `scheduled -> pending`

Este ponto e central.

Como `pending` passa a ser persistido, o backend precisa de uma estrategia para a promocao temporal.

### Opcao 1. Job periodico

Exemplos:

- cron
- Celery Beat
- management command agendado

Vantagem:

- fonte de verdade coerente
- banco fica alinhado com o tempo real

Desvantagem:

- exige infraestrutura operacional minima

### Opcao 2. Promocao oportunista em leitura/escrita

Exemplo:

- ao listar agenda ou cliente, backend normaliza antes de responder

Vantagem:

- mais simples de iniciar

Desvantagem:

- mais facil gerar efeitos colaterais e inconsistencias de timing

## Recomendacao para estabilizacao

Se houver condicao operacional, preferir job periodico.

Se ainda nao houver estrutura para isso, pode-se iniciar com promocao oportunista bem delimitada, mas ela deve ser tratada como etapa intermediaria, nao como desenho final ideal.

## Impacto em `ClientBasic`

Arquivos atuais:

- `backend/apps/clients/views.py`
- `backend/apps/clients/serializers.py`

Hoje o payload de cliente mistura informacao de proximo compromisso e ultimo compromisso.

Com `pending` persistido, a recomendacao e explicitar isso melhor.

### Payload recomendado

Manter:

- `next_appointment_*` para compromissos futuros `scheduled`
- `last_appointment_*` se continuar util

Adicionar:

- `has_pending_appointment`
- `pending_appointment_id`
- `pending_appointment_start_at`
- `pending_appointment_end_at`
- `pending_appointment_title`
- `pending_appointment_status`

Vantagem:

- o frontend deixa de deduzir pendencia por horario e heuristica

## Impacto no frontend depois da migracao

O frontend podera simplificar:

1. remover a heuristica principal de `pending`
2. reduzir buscas ad hoc por compromisso vencido
3. tratar `pending` como dado recebido do backend
4. manter `ongoing` apenas como leitura operacional ou visual

## Ordem segura de implementacao

### Etapa 1. Especificacao fechada

Confirmar este documento antes de alterar codigo.

### Etapa 2. Dominio do `Appointment`

1. adicionar `pending` ao enum de status
2. revisar regras do model e serializer
3. revisar conflito de agenda para considerar apenas `scheduled`

### Etapa 3. Transicoes de endpoint

1. ajustar `finalize` para levar a `pending`
2. ajustar `cancel` para aceitar `pending`
3. criar ou adaptar resolucao para `pending -> done`

### Etapa 4. Payloads de cliente e agenda

1. enriquecer `ClientBasic`
2. opcionalmente enriquecer `AppointmentSerializer` com campos derivados como `is_ongoing`

### Etapa 5. Promocao temporal

1. implementar estrategia de `scheduled -> pending`
2. validar repetidamente a consistencia temporal

### Etapa 6. Simplificacao do frontend

1. reduzir `useClientPendingState`
2. reduzir `usePendingGuard`
3. revisar `usePendingActionsListeners`
4. remover monitoramento redundante

## Regras que nao devem ser perdidas durante a migracao

1. novo horario implica novo agendamento
2. `pending` nao e reprogramavel
3. `done` e `canceled` sao terminais
4. `ongoing` nao deve virar novo status persistido
5. o frontend nao deve voltar a inferir a regra principal sozinho

## Decisao recomendada desta etapa

Para a proxima fase de implementacao, a recomendacao tecnica e:

1. persistir `pending` no backend
2. manter `ongoing` como estado apenas operacional
3. mudar `finalize` para transicao de encerramento operacional em vez de `done` direto
4. deixar o frontend consumir essa nova verdade depois que o backend estiver consistente

## Resultado esperado

Ao final dessa migracao, a Agenda deve ganhar:

1. estados de compromisso mais claros
2. menos heuristica no frontend
3. menor dependencia de monitoramento local de tempo
4. comportamento mais previsivel na resolucao de pendencias
5. base mais segura para evolucao futura sem reabrir a fragilidade atual