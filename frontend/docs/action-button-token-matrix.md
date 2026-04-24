# Action Buttons - Step 1 (Token Semantics)

Objetivo: separar identidade de tema (header, areas de marca) de intencao de acao (Salvar, Fechar, Cancelar etc.) para reduzir custo de manutencao quando trocar tema.

## Regras base

- Token de tema controla identidade global: header, botao de saida, destaques de navegacao.
- Token de acao controla botoes de fluxo: primario, neutro, secundario, perigo.
- Token de status controla badges/cartoes de estado: Concluido, Cancelado, Pendente.
- Cor de status nao deve definir cor de botao de acao por padrao.
- Excecao validada: alguns botoes de fluxo podem acompanhar tokens de status quando a propria acao comunica o estado do compromisso.

## Matriz Acao -> Intencao -> Token

| Rotulo atual | Intencao | Token sugerido | Observacao |
| --- | --- | --- | --- |
| Criar | primary | `--btn-primary-*` | Mesmo papel de Salvar |
| Salvar | primary | `--btn-primary-*` | Acao confirmatoria |
| Editar | secondary | `--btn-secondary-*` | Acao intermediaria |
| Fechar | neutral | `--btn-neutral-*` | Fecha modal sem destrutividade |
| Cancelar (destrutivo) | danger | `--btn-danger-*` | Cancela compromisso/acao com impacto |
| Sair (sessao) | theme-primary | `--color-theme-primary-*` | Identidade do tema, nao acao de formulario |
| Ir para Consulta | secondary-strong | `--btn-secondary-*` | Azul fixo derivado de `done`; nao muda com o tema |
| Encerrar e Ir | secondary-strong | `--btn-secondary-*` | Mesmo grupo de Ir para Consulta |
| Pular (renomear) | neutral-subtle | `--btn-neutral-subtle-*` | Sugestao de nome: "Resolver depois" |

## Tokens propostos (sem codar ainda)

```css
:root {
  /* Tema (identidade) */
  --color-theme-primary: var(--color-primary);
  --color-theme-primary-text: #ffffff;

  /* Botoes semanticos */
  --btn-radius: 6px;
  --btn-font-weight: 700;
  --btn-padding-md: 8px 12px;

  --btn-primary-bg: var(--color-success-dark);
  --btn-primary-border: var(--color-success-darker);
  --btn-primary-text: #ffffff;

  --btn-secondary-bg: var(--color-done);
  --btn-secondary-border: color-mix(in oklab, var(--color-done) 60%, #0000);
  --btn-secondary-text: #ffffff;

  --btn-neutral-bg: #e5e7eb;
  --btn-neutral-border: #d1d5db;
  --btn-neutral-text: #1f2937;

  --btn-neutral-subtle-bg: #f3f4f6;
  --btn-neutral-subtle-border: #e5e7eb;
  --btn-neutral-subtle-text: #4b5563;

  --btn-danger-bg: var(--color-canceled);
  --btn-danger-border: var(--color-danger-dark);
  --btn-danger-text: #ffffff;
}
```

## Mapeamento inicial por tela (fase de aplicacao)

1. QuickScheduleModal
- Cancelar -> neutral
- Criar/Salvar -> primary
- Fechar (mensagens) -> neutral

2. PendingActionsModal
- Fechar -> neutral
- Ir para Consulta / Encerrar e Ir -> secondary (azul fixo de `done`)
- Cancelar -> danger (vermelho fixo de `canceled`)
- (Opcional) Pular -> neutral-subtle com rotulo "Resolver depois"

3. WeeklyPreviewModal
- Hoje e mini icone calendario seguem padrao de navegacao da Agenda diaria
- Acoes de card seguem a mesma semantica do PendingActions

4. AppointmentDetailsModal
- Editar -> secondary
- Fechar -> neutral

5. Areas que seguem o tema ativo
- Header superior / identidade global
- Botao Sair
- Registrar Atendimento / Servicos Prestados / botoes +Novo / +Novo produto / +Novo servico
- Titulos e subtitulos azuis de visualizacao e formularios
- Botao Salvar em formularios que pertencem ao fluxo principal do tema
- Icones de acao ligados ao tema (ex.: enviar orcamento, botao +, fundo do botao Enviar)

6. Areas que NAO seguem a troca de tema
- Badge/cartao de status `Concluido` -> azul fixo de status
- Badge/cartao de status `Cancelado` -> vermelho fixo de status
- Botoes de fluxo que deliberadamente refletem o estado do compromisso (`Ir para Consulta`, `Cancelar` em Pending Actions)

## Decisoes para validar com o usuario

1. Confirmado: Criar/Salvar ficam no eixo verde como principal.
2. Confirmado: Ir para Consulta continua azul fixo de status `done`.
3. Confirmado em aberto: renomeacao de "Pular" ainda precisa de decisao final.
4. Confirmado: Sair segue token de tema (e nao token de acao).
5. Confirmado: efeitos hover/focus devem ficar visiveis em todos os botoes.
6. Confirmado: telas de configuracao podem usar neutral alternativo quando o botao some no fundo do modal.

## Definicao de pronto do passo 1

- Matriz semantica aprovada.
- Nomes principais dos tokens aprovados.
- Rotulo substituto de "Pular" ainda pendente.
- Fase 2 iniciada: QuickSchedule e PendingActions receberam o primeiro lote de padronizacao.
