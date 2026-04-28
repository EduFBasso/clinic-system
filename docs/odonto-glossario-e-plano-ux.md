# Odonto - Resumo de Decisoes, Glossario e Plano UX (Proxima Interface)

Data: 2026-04-28
Status: planejamento funcional (sem codar)

## 1) Resumo das Decisoes (alinhadas)

1. Escopos principais de registro:
- Geral (sem dente/face)
- Dente/Face (vinculado a arcada)

2. Face padronizada:
- Usar as 5 opcoes padrao ja existentes no sistema: O, PO, MO, VO, LDI.
- Entrada recomendada: dropdown/chips de selecao unica.

3. Registro de tratamento:
- Neste momento, seguir o padrao do ERP para garantir continuidade historica e compatibilidade.
- `Procedure.name` representa o nome do procedimento.

4. Sobre nomes fora do ERP:
- Possibilidade real e util (personalizacao da profissional).
- Nao entra agora para manter simplicidade.
- Pode virar evolucao futura: opcao padrao + opcao personalizada persistida.

5. Prioridade de UX:
- Agilidade no toque: selecionar dente, selecionar face, selecionar procedimento e salvar rapido.

## 2) Como pensar Procedure.name sem quebrar padrao

`Procedure.name` e o campo central para descrever o que foi executado/planejado.

Cenario atual (recomendado):
- Usar nomes padronizados do ERP (mais seguro para retorno da Bruna).

Cenario futuro (opcional):
- Combinar lista padrao + entrada personalizada da profissional.
- Esse modelo aumenta produtividade, mas exige governanca (duplicidades, sinonimos, revisao).

Regra pratica:
- Primeiro garantir estabilidade com padrao.
- Depois abrir personalizacao controlada.

## 3) Glossario Rapido (leitura do produto)

- Arcada: conjunto do mapa dentario do cliente (32 dentes) e seus registros.
- Dente (FDI): numero internacional do dente (11..48).
- Face: parte do dente onde o procedimento pode ocorrer.
- Procedimento: acao clinica registrada (pendente/concluida/cancelada).
- Pendente: tratamento indicado mas ainda nao finalizado.
- Concluido: tratamento executado.
- Cancelado: tratamento interrompido ou invalido no plano.
- Geral (sem dente): procedimento sem vinculacao anatomica especifica.

### Faces padrao usadas no sistema

- O: Oclusal
- PO: Palatina/Oclusal
- MO: Mesial/Oclusal
- VO: Vestibular/Oclusal
- LDI: Lingual/Distal/Incisal

Nota importante:
- Face nao e diagnostico.
- Exemplo: "carie" e um achado/problema clinico; o registro operacional entra como procedimento (com nome/codigo/status), opcionalmente com observacao clinica.

## 4) Plano da Proxima Interface: "Geral" (sem arcada)

Objetivo:
- Permitir registrar rapidamente procedimentos que nao dependem de dente/face.

### Fluxo UX proposto (simples e pratico)

1. Entrada
- Botao "Novo procedimento geral" no topo da pagina de arcada.

2. Formulario minimo (modal leve)
- Tipo: fixo em "Geral"
- Procedimento (obrigatorio): dropdown pesquisavel
- Status (obrigatorio): padrao em "Pendente"
- Data (opcional)
- Valor (opcional)
- Observacao (opcional)

3. Acoes
- Salvar
- Salvar e novo (otimizacao de ritmo)
- Cancelar

4. Lista de retorno
- Exibir em "Procedimentos gerais (sem dente)" com status e data.
- Permitir acao rapida de status: pendente/concluido/cancelado.

### Regras de validacao

- Nao exigir dente.
- Nao exigir face.
- Exigir nome do procedimento.
- Se status = concluido e data vazia: opcionalmente preencher com hoje.

### Elementos de interface recomendados

- Dropdown pesquisavel para procedimento.
- Radio button para status (3 opcoes).
- Input simples para data e valor.
- Botao primario "Salvar" com foco em um clique.

## 5) Riscos e cuidados

- Evitar excesso de campos na primeira versao (para nao travar o uso).
- Nao misturar "Geral" com "Dente/Face" no mesmo formulario inicial.
- Manter coerencia visual com os cartoes atuais (pendente/concluido/cancelado).

## 6) Proximo passo apos validacao deste plano

1. Implementar primeiro o modal de "Procedimento geral".
2. Integrar com API existente de `Procedure` (tooth/surface nulos).
3. Testar fluxo real com 3 casos:
- salvar pendente
- concluir procedimento geral
- cancelar e reabrir
