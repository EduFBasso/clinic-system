# Agenda Stabilization Analysis - Current State

Este documento parte da estrutura atual do codigo e responde a pergunta pratica:

"A Agenda ja esta estavel o bastante para receber novos recursos, ou ainda precisamos fechar alguns pontos antes?"

O foco aqui nao e historico. O foco e estado presente.

## Resposta curta

A Agenda esta substancialmente mais estavel do que antes, mas ainda nao esta em um ponto em que valha ampliar comportamento de forma livre.

Hoje o sistema ja tem base suficiente para continuar testando com confianca moderada, porque a estrutura principal melhorou. Ao mesmo tempo, ainda existem alguns pontos de centralizacao e alguns fallbacks legados que fazem sentido tratar como "zona de freeze" antes de introduzir novas regras de negocio.

Leitura objetiva:

- a base principal esta melhor
- os fluxos criticos mais visiveis estao mais previsiveis
- os riscos restantes ficaram mais concentrados
- por isso este e exatamente o momento de finalizar a estabilizacao, nao de expandir a complexidade

## Estado atual da estrutura

### 1. O ownership dos fluxos ficou mais claro

Hoje a Agenda depende principalmente de:

- `Home.tsx` como host global dos modais principais
- `useAgendaModals.ts` como camada de coordenacao de abertura
- `useHomeResumeFlows.ts` como camada de reabertura e continuidade
- `PendingReturnContext` como contrato de retorno entre fluxos

Isso e uma melhora estrutural real.

Antes, parte relevante da complexidade era causada por ownership distribuido. Hoje a maior parte da complexidade esta mais concentrada e explicita.

Isso nao elimina risco, mas torna o risco mais controlavel.

### 2. O sistema ainda depende de uma infraestrutura compartilhada sensivel

O maior ponto de sensibilidade continua sendo `Modal.tsx`.

Mesmo depois da simplificacao, esse componente ainda acumula responsabilidade em excesso:

- lock de scroll
- unlock defensivo
- restore de foco
- restore de scroll
- tratamento iOS
- compensacao de viewport
- neutralizacao de roots residuais do MUI

Leitura pratica:

- a Agenda esta mais estavel apesar do `AppModal`
- ela ainda nao esta estavel por causa do `AppModal`

Essa diferenca importa muito para a fase seguinte.

### 3. O QuickSchedule continua sendo o centro funcional mais delicado

`QuickScheduleModal.tsx` e `useQuickScheduleSave.ts` ainda sao a area mais sensivel do dominio de compromissos.

Motivo:

- criacao
- edicao
- conflito
- reaproveitamento de horario
- passagem para pendencias
- preservacao de draft
- fechamento com feedback

Esse conjunto torna o QuickSchedule o ponto mais importante de regressao funcional.

Leitura pratica:

- se houver nova funcionalidade de Agenda, ela nao deve ser despejada aqui sem necessidade forte

## O que ja pode ser tratado como base estabilizada

### 1. Host global na Home

O fato de `ClientCard` nao hospedar mais o QuickSchedule localmente e uma das melhores mudancas recentes.

Isso deve ser tratado como decisao estabilizada.

Recomendacao:

- nao reintroduzir ownership local de modal de agendamento em card, lista ou mini-card

### 2. Retorno tipado entre Agenda, pendencia, consulta e desktop

O `PendingReturnContext` ja deixou de ser detalhe e virou infraestrutura de fluxo.

Isso tambem deve ser tratado como decisao estabilizada.

Recomendacao:

- todo novo retorno de fluxo deve passar por contexto tipado
- nao voltar a inferir retorno por heuristica ou ultimo estado conhecido

### 3. Feedback nao modal para retorno da Home

A introducao de flash nao modal para parte do retorno foi um passo correto de estabilizacao.

Isso vale especialmente para casos em que:

- o modal principal acabou de fechar
- o usuario so precisa de confirmacao visual
- nao existe nenhuma decisao adicional a tomar

Isso tambem deve ser preservado.

## Riscos remanescentes mais importantes

## 1. Risco estrutural alto: `AppModal` continua sendo um componente com responsabilidade demais

Impacto:

- qualquer mudanca global aqui pode reabrir bug em multiplos fluxos
- especialmente em iPhone Safari/WebKit

Consequencia para a estabilizacao:

- durante o freeze, mudar `AppModal` deve ser excecao, nao caminho padrao

Decisao recomendada:

- bug novo de Agenda deve ser investigado primeiro no fluxo de ownership e fechamento
- so depois, se sobrar evidenca forte, tocar em `AppModal`

## 2. Risco funcional real: `PendingActionsListeners` ainda tem um ponto de perda de contexto

No caminho em que `pendingActions:open` chega apenas com `appointmentId`, o listener faz o fetch do appointment e abre o modal, mas zera `pendingReturnContext` em vez de preservar `det.returnContext`.

Arquivo relevante:

- `frontend/src/hooks/usePendingActionsListeners.ts`

Leitura pratica:

- alguns fluxos ja preservam contexto quando enviam o appointment completo
- mas o caminho por `appointmentId` ainda pode perder a origem pretendida

Consequencia:

- isso e exatamente o tipo de fragilidade que pode passar despercebida em testes superficiais e reaparecer depois como "retorno estranho"

Status desta analise:

- nao e necessariamente um bug aberto em todos os casos
- mas e um ponto de estabilizacao ainda incompleto

## 3. Risco medio: `ensureScrollUnlocked` ainda existe como fallback difuso

Mesmo com o `unlockPageScroll`, o evento `ensureScrollUnlocked` continua espalhado em varios pontos do frontend.

Leitura pratica:

- hoje ele funciona mais como rede de seguranca do que como mecanismo primario
- isso e melhor do que antes
- mas ainda cria ambiguidade sobre quem realmente e responsavel pelo unlock

Consequencia:

- quanto mais tempo esse fallback continuar amplo, mais facil e adicionar comportamento novo apoiado nele sem perceber

Decisao recomendada:

- manter por enquanto como fallback
- evitar qualquer novo recurso que dependa dele como mecanismo principal

## 4. Risco medio: `Home.tsx` esta melhor, mas continua sendo um shell muito carregado

Hoje a Home acumula:

- parse de URL
- listeners globais
- resume flows
- flash messages
- system messages
- ownership de multiplos modais
- unlock de pagina

Isso ainda e aceitavel nesta fase porque a Home agora e o orquestrador legitimo do fluxo.

Mas ha um limite.

Consequencia:

- novas features colocadas diretamente em `Home.tsx` vao piorar a estabilizacao em vez de ajudar

Decisao recomendada:

- durante o freeze, a Home so deve receber ajustes de estabilizacao e pequenos refinamentos de ownership

## 5. Risco controlado: storage de resume continua sendo infraestrutura critica

Hoje chaves como estas continuam importantes:

- `resumeQuickSchedule`
- `resumeAgendaModal`
- `resumeDesktopAgenda`
- `reopenAppointmentDetails`

Leitura pratica:

- agora elas estao mais organizadas
- mas continuam sendo um ponto em que regressao de serializacao/consumo pode afetar continuidade de fluxo

Decisao recomendada:

- nao criar novas chaves ad hoc durante a fase de estabilizacao sem contrato tipado e consumidor unico

## O que eu consideraria "freeze criteria" antes de novos recursos

Para dizer que a Agenda esta pronta para crescer sem alto risco, eu usaria estes criterios:

### Criterio 1. Fluxos criticos precisam passar de forma repetivel

Minimo desejavel:

- criar compromisso simples
- editar compromisso existente
- criar com conflito e resolver
- bloquear por pendencia e retomar
- finalizar e ir para consulta com retorno
- abrir detalhes, navegar e voltar
- retornar para Home sem scroll lock

Nao basta um unico teste manual isolado. O importante e repetibilidade.

### Criterio 2. Nenhum novo owner local de modal

Se um novo recurso de Agenda exigir modal, ele deve entrar pelo host existente ou por outro host global claramente definido.

Se surgir novo modal local em card ou lista, isso ja deve ser tratado como sinal de regressao estrutural.

### Criterio 3. Nenhuma nova feature deve depender de fallback global para funcionar

Especialmente:

- `ensureScrollUnlocked`
- storage ad hoc sem contrato
- heuristica para descobrir tela de retorno

Se precisa disso para funcionar, ainda nao esta pronto para entrar.

### Criterio 4. `AppModal` deve ficar relativamente quieto

Se toda nova rodada de teste acaba exigindo novo ajuste em `Modal.tsx`, entao a base ainda nao esta estabilizada.

Durante freeze, o esperado e o oposto:

- pequenos bugs devem ser corrigidos no fluxo
- `AppModal` deve ser tocado pouco

## Recomendacao objetiva para a fase atual

### O que fazer agora

1. continuar os testes manuais dos fluxos criticos da Agenda
2. tratar os pontos remanescentes de contexto e retorno
3. reduzir dependencia efetiva de fallbacks globais
4. considerar a Home e o QuickSchedule como areas congeladas para feature work amplo

### O que nao fazer agora

1. introduzir novo recurso que crie nova pilha modal
2. colocar comportamento raro como eixo de arquitetura
3. expandir `AppModal` com nova inteligencia global sem evidencia forte
4. espalhar novos atalhos por evento global ou session/local storage fora do contrato atual

## Leitura final

Do ponto de vista de estabilizacao, a Agenda esta em uma fase boa, mas ainda intermediaria.

Ela ja saiu do estado de fragilidade difusa e entrou em um estado de fragilidade concentrada.

Isso e progresso real.

Agora o alvo correto nao e ampliar comportamento. O alvo correto e terminar de limpar os pontos concentrados restantes.

Em termos praticos:

- a Agenda ja permite testar com mais confianca
- a estrutura atual ja sustenta uma rodada seria de validacao
- mas ainda vale fechar a estabilizacao antes de abrir frente de recursos novos

## Proximo uso recomendado deste documento

Usar esta analise como filtro para cada mudanca nova:

1. toca `AppModal`?
2. toca ownership de modal?
3. toca `returnContext`?
4. toca resume por storage?
5. toca QuickSchedule em comportamento raro?

Se a resposta for sim para mais de um item, a mudanca nao deve entrar como feature comum. Deve ser tratada como mudanca de estabilizacao e testada como tal.