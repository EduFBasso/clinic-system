# Agenda Stabilization Map

Este documento limita o escopo a Agenda, isto é, aos fluxos de compromissos.

O objetivo aqui nao e descrever cada detalhe de implementacao, e sim deixar claro:

- qual e a estrutura atual
- quais fluxos sao criticos
- o que ja foi estabilizado recentemente
- onde ainda existe fragilidade estrutural
- qual deve ser a direcao das proximas mudancas

## Objetivo de engenharia

O foco da Agenda neste momento e estabilizacao.

Isso significa priorizar:

- previsibilidade de navegacao
- ownership claro de modal
- preservacao explicita de contexto de retorno
- reducao de efeitos colaterais globais
- menos dependencia de storage/eventos difusos como motor principal do fluxo

Nao significa expandir comportamento raro ou sofisticar fluxos excepcionais alem do necessario.

## Leitura do historico recente

Os commits recentes mostram uma sequencia coerente de estabilizacao da Agenda:

- `dcc4253` Stabilize agenda flows and quick schedule conflicts
- `34a4ef5` Stabilize AppModal global unlock fallback
- `afde3f8` Align agenda event bus contracts
- `4eb99df` Type quick schedule return flow
- `e5f93ef` Consolidate pending appointment opening
- `4ec1ac6` Fix quick schedule close flow from client card
- `7242c30` Repair weekly and monthly agenda modal flows
- `08bd6c7` Stabilize agenda pending and quick schedule flows
- `d6e5627` Modularize frontend shell and agenda helpers

Leitura pratica dessa sequencia:

- primeiro houve correcao de sintomas e conflitos de fluxo
- depois consolidacao de contratos e tipos de retorno
- em seguida centralizacao de ownership e helpers de Agenda
- por fim modularizacao da casca da Home e dos pontos de abertura

Ou seja: o projeto saiu de uma estrutura mais acoplada e oportunista para uma estrutura mais roteada por host global e contexto tipado.

## Estrutura atual

### Host principal

O host principal dos fluxos de Agenda na Home esta em `frontend/src/pages/Home.tsx`.

Responsabilidades atuais da Home:

- hospedar os modais globais de Agenda
- manter o estado de abertura dos modais principais
- ouvir eventos globais de pendencia e detalhes
- recompor fluxos apos retorno usando `useHomeResumeFlows`
- aplicar desbloqueio explicito de scroll quando a pilha de modais encerra

Hoje a Home funciona como orquestrador da camada de compromissos.

### Hook central de modais

`frontend/src/hooks/useAgendaModals.ts`

Responsabilidades:

- manter estado de `QuickSchedule`, `Daily`, `Weekly`, `Monthly` e `AppointmentDetails`
- expor openers como `openMonthly`, `openWeekly`, `openDaily`
- consolidar bridges de eventos como `openScheduleEdit`, `openDailyAgenda` e `openAppointmentDetails`
- limpar flags de rota apos fechamento

Leitura estrutural:

- a Agenda deixou de depender de ownership distribuido por card
- a abertura passou a ser coordenada por um ponto unico

### Contexto tipado de retorno

`frontend/src/types/agendaFlow.ts`

O tipo `PendingReturnContext` e hoje a peca central para preservar intencao do usuario entre fluxos.

Contextos suportados:

- `quick-schedule`
- `daily-agenda`
- `weekly-agenda`
- `monthly-agenda`
- `desktop-agenda`

Leitura estrutural:

- o sistema parou de depender apenas de estado incidental de tela
- o retorno passou a ser transportado explicitamente

### Reabertura de fluxo

`frontend/src/hooks/useHomeResumeFlows.ts`

Responsabilidades:

- consumir chaves de resume
- reabrir `QuickSchedule` com draft original
- reabrir modais de Agenda por contexto
- reabrir `AppointmentDetails` quando necessario

Leitura estrutural:

- retorno vindo de consulta, pendencias ou navegacao intermediaria deixou de ser apenas um efeito colateral de URL ou storage avulso
- existe agora uma camada explicita de recomposicao

### Pendencias

`frontend/src/hooks/usePendingActionsListeners.ts`

Responsabilidades:

- ouvir `pendingActions:open`
- abrir `PendingActionsModal` globalmente
- carregar appointment quando necessario
- suprimir reaberturas indevidas apos cancelamento ou force close

Leitura estrutural:

- `PendingActionsModal` nao deve mais nascer como responsabilidade local de cada origem
- a origem informa o `returnContext`; a Home coordena a exibicao

### QuickSchedule

Arquivos centrais:

- `frontend/src/components/QuickScheduleModal.tsx`
- `frontend/src/hooks/useQuickScheduleSave.ts`
- `frontend/src/components/quickschedule/QuickScheduleDayList.tsx`

Responsabilidades atuais do QuickSchedule:

- criar ou editar compromisso
- detectar conflito
- destacar compromisso conflitante do dia
- permitir entrar na resolucao do conflito
- preservar draft original para retorno quando necessario
- acionar pendencias com `returnContext`

Leitura estrutural:

- o QuickSchedule virou o centro do fluxo de criacao/edicao, nao apenas um formulario
- por isso ele concentra o maior risco de regressao funcional

## Mapa dos fluxos principais

### 1. Criar compromisso simples pela Home

Origem:

- `ClientCard`
- evento `openScheduleEdit` ou abertura global equivalente

Fluxo:

1. Home abre `QuickScheduleModal`
2. usuario define data e horario
3. `useQuickScheduleSave` persiste
4. Home fecha `QuickSchedule`
5. lista principal atualiza
6. feedback de sucesso e exibido sem recolocar um modal de bloqueio sobre a Home

Pontos criticos:

- fechamento limpo do modal
- desbloqueio do scroll
- feedback nao intrusivo

### 2. Editar compromisso existente

Origem:

- Quick edit vindo da Home, listas futuras ou minicards

Fluxo:

1. abertura com `routeEditAppt`
2. `QuickSchedule` entra em modo de edicao
3. save atualiza appointment existente
4. lista do dia recarrega e destaca item alterado

Pontos criticos:

- evitar perder o contexto do appointment em edicao
- evitar reabrir fluxo local antigo vindo de `ClientCard`

### 3. Criar com conflito de horario

Fluxo atual esperado:

1. usuario tenta criar em horario ocupado
2. backend retorna conflito
3. `QuickSchedule` destaca os appointments conflitantes
4. usuario toca no card em conflito
5. entra em resolucao pela propria Agenda
6. apos ajustar ou remover o conflito, o draft original deve continuar disponivel
7. novo save conclui a criacao

Ponto central da estabilizacao recente:

- preservar o draft original mesmo depois de editar o compromisso conflitante

Sem isso, o sistema perdia a intencao do usuario no meio do fluxo.

### 4. Pendencia anterior bloqueando nova criacao

Fluxo:

1. tentativa de criar compromisso encontra pendencia anterior
2. fluxo abre `PendingActionsModal` global
3. `returnContext` preserva de onde o usuario veio
4. apos resolver, o sistema deve conseguir retomar a Agenda correta

Ponto critico:

- a origem nao deve tentar carregar sua propria pilha de modal localmente

### 5. Finalizar e navegar para consulta com retorno

Fluxo:

1. Agenda ou QuickSchedule aciona finalizacao/pending flow
2. `PendingActionsModal` pode navegar para `/consulta`
3. `returnContext` e persistido
4. Home recompõe o estado ao voltar

Ponto critico:

- se o retorno nao for tipado e consumido explicitamente, a experiencia fica fragil e altamente dependente de ordem de eventos

### 6. Abrir detalhes do compromisso

Fluxo:

1. origem abre `AppointmentDetailsModal`
2. detalhes podem disparar acoes subsequentes
3. `returnContext` garante reabertura coerente quando necessario

Ponto critico:

- detalhes nao devem virar novo centro de ownership do fluxo

## O que ja foi estabilizado

### 1. Ownership global do QuickSchedule

Antes, parte importante do fluxo podia nascer localmente em `ClientCard`.

Agora:

- a Home hospeda o `QuickScheduleModal`
- `ClientCard` apenas sinaliza abertura

Ganho:

- menos pilhas concorrentes de modal
- menos risco de card desmontar ou reter estado invisivel

### 2. Retorno tipado entre Agenda, pendencias e consulta

O `PendingReturnContext` reduziu a ambiguidade do retorno.

Ganho:

- continuidade de fluxo mais previsivel
- menos dependencia de heuristicas ad hoc

### 3. Reabertura centralizada pela Home

`useHomeResumeFlows` concentrou a recompisicao de estado.

Ganho:

- menos duplicacao
- menos reaberturas dispersas por origem

### 4. `PendingActionsModal` global

Pendencias deixaram de ser responsabilidade local de cada ponto da Agenda.

Ganho:

- menos disputa de ownership
- melhor propagacao de `returnContext`

### 5. Melhor preservacao do fluxo de conflito

O draft original do QuickSchedule passou a sobreviver melhor ao fluxo:

- conflito
- abrir compromisso conflitante
- editar/cancelar/finalizar
- voltar para concluir o agendamento original

Ganho:

- o comportamento ficou mais proximo da intencao real do usuario

### 6. Reducao de sintomas de scroll lock no retorno

Houve dois movimentos importantes:

- desbloqueio explicito de pagina
- substituicao de parte do feedback de sucesso por flash nao modal no retorno da Home

Ganho:

- menor probabilidade de voltar para Home com interface visivel, mas ainda bloqueada por lock residual

## Fragilidades que ainda existem

### 1. `AppModal` segue sendo infraestrutura sensivel

Mesmo simplificado, `frontend/src/components/Modal.tsx` continua sendo um ponto de alto risco porque mistura:

- scroll lock
- iOS lock manual
- restore de foco
- restore de scroll
- compensacao de viewport
- neutralizacao de roots residuais

Leitura pratica:

- qualquer ajuste global aqui pode resolver um caso e reabrir outro

### 2. Agenda ainda usa eventos globais em varios pontos

Ainda existe dependencia de eventos como:

- `systemMessage`
- `ensureScrollUnlocked`
- `appointments:changed`
- `pendingActions:open`

Leitura pratica:

- eventos continuam uteis como ponte
- mas quando viram motor principal de sincronizacao, a previsibilidade cai

### 3. `QuickSchedule` concentra responsabilidade demais

Hoje ele faz ao mesmo tempo:

- formulario
- leitura do dia
- destaque de conflito
- ponte para pendencias
- resolucao indireta de conflito
- continuidade de draft

Leitura pratica:

- ele funciona como hub de caso de uso, nao apenas componente de input
- por isso mudancas nele precisam ser minimas e muito testadas

### 4. Fluxos raros continuam caros

Exemplo claro:

- alterar o horario de um compromisso ja agendado para liberar faixa e concluir outro compromisso em seguida

Esse fluxo e valido e hoje funciona, mas nao deve guiar a arquitetura inteira.

Leitura pratica:

- suportar o caso raro e correto
- otimizar a arquitetura inteira em volta dele nao necessariamente e correto

## Direcao recomendada de estabilizacao

### Regra 1. Um host por fluxo global

Para fluxos de compromissos, a Home deve continuar sendo o host global principal.

Evitar:

- reintroduzir modal local em `ClientCard`
- abrir cadeia paralela de modais em componentes de lista

### Regra 2. Retorno deve ser dado, nao inferido

Se um fluxo precisa voltar para algum lugar, isso deve trafegar em `returnContext`.

Evitar:

- inferencia por estado incidental
- deducao por ultimo modal aberto
- heuristica baseada em timing

### Regra 3. Feedback de sucesso nao deve bloquear Agenda

Sucesso apos fechar fluxo principal deve preferir feedback nao modal.

Usar modal de sucesso apenas quando realmente exigir decisao do usuario.

### Regra 4. `AppModal` deve perder, nao ganhar, inteligencia global

Se surgir novo bug, a primeira opcao nao deve ser adicionar mais watchdog global no modal compartilhado.

Melhor ordem de raciocinio:

1. corrigir ownership do fluxo
2. corrigir ordem de fechamento
3. corrigir retorno/contexto
4. apenas por ultimo tocar na infraestrutura global

### Regra 5. Casos raros precisam funcionar, mas nao devem virar eixo da arquitetura

Manter suporte funcional.

Evitar:

- ramificacoes permanentes demais para excecoes raras
- sobrecarga de estado invisivel para sustentar um unico caso especial

## Leitura da estrutura atual

Hoje a Agenda esta mais estavel porque ficou mais explicita.

As melhorias mais relevantes nao vieram de truques de CSS ou patches isolados, e sim de tres movimentos de arquitetura:

- centralizacao de ownership
- tipagem do retorno
- reducao de pilha modal concorrente

Isso e o que deve ser preservado.

## Checklist para futuras mudancas na Agenda

Antes de alterar qualquer fluxo de compromissos, revisar:

1. quem e o owner deste modal?
2. o retorno esta explicito em `PendingReturnContext`?
3. o fechamento recoloca algum modal de sucesso por cima da Home?
4. ha dependencia de evento global que poderia ser chamada direta?
5. o fluxo raro esta exigindo complexidade estrutural demais?
6. a mudanca toca `AppModal` ou apenas o fluxo de negocio?

## Proximos passos recomendados

### Curto prazo

- revisar outros sucessos da Agenda que ainda usam modal e avaliar migracao para flash nao modal
- reduzir pontos que ainda dependem de `ensureScrollUnlocked` como fallback principal
- validar os fluxos criticos em iPhone Safari/WebKit

### Medio prazo

- separar melhor a logica de conflito do restante do `QuickSchedule`
- reduzir acoplamento entre UI de lista do dia e fluxo de persistencia
- documentar um mapa de testes manuais da Agenda por fluxo critico

### Nao prioritario agora

- sofisticar comportamento para casos excepcionais raros
- ampliar regras globais no `AppModal`
- introduzir novos atalhos de reabertura sem contexto tipado

## Conclusao

A Agenda avancou bastante em estabilizacao.

O ganho real nao esta apenas em bugs corrigidos, mas em uma mudanca de forma:

- menos ownership distribuido
- menos dependencia de empilhamento modal acidental
- mais fluxo orientado por contexto explicito

Se a manutencao seguir essa linha, a tendencia e reduzir regressao.

Se voltar a crescer por patches locais, listeners globais e ownership duplicado, a fragilidade retorna rapido.