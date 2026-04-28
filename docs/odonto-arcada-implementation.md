# Arcada Odontologica - Documento Vivo de Implementacao

Status: em andamento
Ultima atualizacao: 2026-04-27 (Fase 2 iniciada)

## Objetivo

Integrar a arcada odontologica ao fluxo central de clientes, com foco em:

- Estabilidade
- Clareza visual
- Baixo atrito de uso para acessar e operar o subcomponente visual (dente/face)

## Decisao de Entrada no Fluxo

- Acesso principal pela linha de acoes do ClientCard
- Posicao recomendada: icone da arcada na primeira linha, ao lado esquerdo do icone editar
- Visibilidade restrita a profissionais da area odontologica

## Avaliacao de Recursos Graficos (Desenho da Arcada)

Pergunta: React ja tem um "modelo pronto" consolidado de arcada?

Resposta pratica para este projeto:

- Nao ha um padrao dominante e maduro no ecossistema React para odontograma completo com o mesmo controle de regras clinicas do nosso dominio
- Para priorizar estabilidade e clareza, a melhor estrategia inicial e SVG customizado controlado pelo proprio app

Opcoes avaliadas:

1. SVG customizado (recomendado)
- Pro: previsivel, acessivel, sem dependencia extra, controle total de hit-area por dente/face
- Pro: excelente para evoluir incrementalmente (fase 2 e fase 3)
- Contra: exige desenho inicial do mapa

2. Canvas
- Pro: performatico para desenhos muito complexos
- Contra: menor acessibilidade e manutencao mais dificil para interacao granular de dente/face

3. Biblioteca externa de odontograma
- Pro: acelera prototipo
- Contra: risco de manutencao, acoplamento e ajustes limitados ao fluxo clinico local

Diretriz adotada:

- Fase 2 com SVG customizado simples (32 dentes + estados)
- Fase 3 evolui para faces clicaveis por dente

## Fases de Implementacao

## Fase 1 - Entrada e Controle de Acesso

Objetivo:

- Entregar atalho da arcada no ClientCard
- Restringir exibicao por especialidade odontologica
- Criar pagina base da arcada para receber os proximos incrementos

Checklist:

- [x] Documento vivo criado
- [x] Icone no ClientCard (acao Arcada)
- [x] Gate por especialidade odontologica
- [x] Rota base da arcada criada
- [ ] Testes de UX com fluxo real da Bruna

## Fase 2 - Visual Basico da Arcada

Objetivo:

- Exibir estrutura da arcada com leitura clara

Checklist:

- [x] Header clinico do cliente
- [x] Grid/diagrama de 32 dentes (SVG)
- [x] Estados visuais minimos por dente (sem dados, pendente, concluido)
- [x] Abertura de detalhe ao selecionar dente

Entregue nesta etapa:

- Carregamento da arcada ativa por cliente
- Leitura de dentes e procedimentos para pintar estado visual no SVG
- Painel de detalhe por dente selecionado
- Secao inicial de procedimentos gerais (sem dente)

## Fase 3 - Procedimentos e Faces

Objetivo:

- Operar procedimentos por dente/face e gerais

Checklist:

- [ ] Lista de procedimentos por dente/face
- [ ] Lista de procedimentos gerais (sem dente/face)
- [ ] Criar/editar/atualizar status
- [ ] Integracao com regras de status da arcada

## Criterios de Qualidade

- Nada de regressao no ClientCard
- Funcionar bem em desktop e mobile
- Acesso a arcada em no maximo 1 clique a partir do cliente
- Mensagens de erro curtas e acionaveis

## Observacoes Operacionais

- Procedimentos odontologicos podem existir sem vinculo de dente/face (ex.: limpeza)
- Isso deve aparecer na secao de "procedimentos gerais" na tela da arcada
