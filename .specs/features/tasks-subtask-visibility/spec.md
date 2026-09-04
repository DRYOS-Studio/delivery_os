# Visibilidade de subtarefas em /tasks e na edição da tarefa-pai — Specification

## Problem Statement

Subtarefas somem em dois pontos fora da tela da Frente. (1) Em `/tasks`, o
filtro "Responsável" é um inner join em `task_assignees`: subtarefa sem
responsável próprio some da visão mesmo quando sua tarefa-pai bate o filtro
(default de `/tasks` já é "eu"). (2) Ao abrir a tarefa-pai
(`.../tasks/[tid]/edit`), a página só mostra o form da própria task —
`countSubtasks` ali só decide elegibilidade de virar pai de outra task, nunca
lista as filhas. Causa raiz provada via `/dryos-debug` nesta sessão
(`src/lib/db/queries/tasks.ts:261-276,333-334`; subtarefa nasce sem
responsável — `TaskForm.tsx:103`, `assignee_person_ids: []` no default de
criação; `edit/page.tsx:34-36`, `countSubtasks` calculado e nunca
renderizado).

## Goals

- [ ] Subtarefa **sem responsável próprio** aparece em `/tasks` sempre que sua
      tarefa-pai bate o filtro de Responsável selecionado — **em qualquer
      aba de status** (Abertas/Concluídas/Todas), mesmo se a tarefa-pai
      estiver em status diferente da subtarefa. A visibilidade herda do pai;
      a aba onde a linha cai usa **só o status da própria subtarefa** (igual
      já funciona hoje pra qualquer task).
- [ ] Contagem dos badges (Abertas/Concluídas/Todas) bate com o que a lista
      mostra sob o mesmo filtro, a menos do teto de `TASKS_PAGE_LIMIT` (200) —
      truncamento continua sendo sinalizado pelo banner existente, não
      escondido pra "bater" a contagem.
- [ ] Abrir uma tarefa-pai com subtarefas mostra a lista de subtarefas ali
      mesmo, sem navegação extra.

## Out of Scope

- Paginação / `TASKS_PAGE_LIMIT` (200) — descartado como causa pelo usuário,
  volume real é baixo. A ressalva de truncamento no Goal 2 é só pra não
  quebrar o banner existente, não reabre a investigação.
- Indent/badge de subtarefa em `/tasks` (achado do fool-gate, `MyTaskListItem`
  não tem nenhuma afordância de subtarefa) — **decisão: fora de escopo nesta
  feature**, mesmo sabendo que a subtarefa fica indistinguível de uma
  top-level ali. Aceitável com o volume atual (~5 tarefas); registrar como
  débito, não resolver por engenharia extra não pedida.
- Herança de responsável em outras superfícies fora de `/tasks` — inclui
  explicitamente o badge "Tasks" da `Sidebar` (`countMyOpenTasks`,
  `tasks.ts:397-410`), que continua usando o join estrito e pode divergir do
  subtítulo da própria página `/tasks` que ele linka. Débito aceito, não bug
  novo desta feature.

---

## User Stories

### P1: Subtarefa herda visibilidade de responsável da tarefa-pai em `/tasks` ⭐ MVP

**User Story**: Como usuário filtrando `/tasks` por responsável (inclusive o
default "eu"), quero ver as subtarefas das minhas tarefas mesmo que elas não
tenham responsável próprio, pra não perder rastro delas.

**Why P1**: É o sintoma relatado — subtarefa vira trabalho invisível fora da
tela da Frente.

**Acceptance Criteria**:

1. WHEN o filtro Responsável = pessoa P (inclusive o default sem query param)
   AND uma subtarefa **não tem NENHUM responsável próprio** AND sua
   tarefa-pai tem P como responsável THEN `/tasks` SHALL listar essa
   subtarefa.
   — Mutação que este AC mata: reverter pro `task_assignees!inner` +
   `.eq("assignees.person_id", P)` puro de hoje (sem lookup de pai) — precisa
   reprovar.
2. WHEN o filtro Responsável = pessoa P AND uma subtarefa **tem responsável
   próprio Q≠P** (mesmo que a tarefa-pai tenha P) THEN `/tasks` SHALL NÃO
   listar essa subtarefa pela herança — só apareceria se Q também for P
   (match direto).
   — Mutação que este AC mata: herança incondicional por `parent_task_id`
   sem checar se a subtarefa já tem responsável próprio (vazaria trabalho
   explicitamente delegado a outra pessoa pra dentro da view "eu"). Esta é a
   leitura resolvida do dilema apontado pelo fool-gate na rodada 1: herança
   é só para subtarefa **órfã de responsável**, não um "OR" geral com o pai.
3. WHEN o filtro Responsável = pessoa P AND uma subtarefa sem responsável
   próprio AND sua tarefa-pai NÃO tem P como responsável THEN `/tasks` SHALL
   NÃO listar essa subtarefa.
   — Mutação que este AC mata: fix ingênuo que inclui TODA subtarefa sem
   responsável quando há qualquer filtro de responsável, ignorando quem é o
   pai (vazamento de tarefa de operação/frente alheia à P).
4. WHEN o filtro Responsável = "Todos" THEN o comportamento SHALL permanecer
   igual ao atual (sem regressão) — todas as tasks visíveis por RLS, pai e
   filha, aparecem, sem aplicar a lógica de herança (ela só existe pra
   resolver o `!inner` que só roda quando há `assigneePersonId`).
   — Mutação que este AC mata: a correção rodar o `.or()` de herança também
   quando `assigneePersonId` é `undefined`.
5. WHEN a tarefa-pai tem status `done` E a subtarefa (sem responsável
   próprio) tem status `todo`/`doing`/`blocked` THEN a subtarefa SHALL
   continuar aparecendo na aba "Abertas" sob o filtro de P — a herança de
   VISIBILIDADE (quem pode ver) é independente do status do PAI; a aba que
   decide onde a linha cai usa o status da PRÓPRIA subtarefa, igual já
   acontece hoje pra qualquer task.
   — Mutação que este AC mata: resolver os ids de tasks-de-P reusando o
   mesmo query builder já filtrado por `.in("status", OPEN_STATUSES)` — nesse
   caso um pai `done` nunca entra no lookup e a subtarefa `todo` some da aba
   "Abertas" mesmo P sendo o responsável do pai. O lookup de ids-de-P SHALL
   ser sem filtro de status.
6. WHEN os badges do toolbar (Abertas/Concluídas/Todas) são calculados por
   `countTasks` sob o filtro de responsável P THEN o número SHALL ser igual
   à contagem de linhas que `listTasks` retornaria sob o mesmo filtro **até o
   teto de `TASKS_PAGE_LIMIT`** (fonte única da regra de herança — mesmo
   lookup de ids reaproveitado nos dois, não duas implementações
   divergentes; acima do teto o banner de truncamento continua sinalizando a
   diferença, não é regressão).
   — Mutação que este AC mata: aplicar a herança só em `listTasks` e deixar
   `countTasks` com o inner join antigo — precisa reprovar (contagem diverge
   da lista real abaixo do teto).

**Independent Test**: com uma tarefa-pai atribuída ao usuário logado e uma
subtarefa sem responsável, abrir `/tasks` (default) e ver as duas na lista;
trocar o filtro pra outra pessoa e ver as duas sumirem; dar `done` na
tarefa-pai e confirmar que a subtarefa `todo` continua na aba "Abertas".

---

### P1: Subtarefas visíveis ao abrir a tarefa-pai ⭐ MVP

**User Story**: Como usuário editando uma tarefa que tem subtarefas, quero
ver a lista delas na mesma página, pra não precisar voltar pra tela da
Frente pra saber o que existe embaixo dela.

**Why P1**: É o segundo sintoma relatado, e sem ele o primeiro fix só resolve
metade do caso de uso (ver a subtarefa na lista geral, mas não a partir do
pai).

**Acceptance Criteria**:

1. WHEN o usuário abre `.../tasks/[tid]/edit` de uma tarefa que tem 1+
   subtarefas THEN a página SHALL exibir a lista dessas subtarefas
   reaproveitando `TaskListItem` em modo `isSubtask`, **sem componente novo**
   — o mesmo componente já usado na tela da Frente, com o mesmo
   comportamento que ele já tem lá: título, status, responsável, tags, prazo,
   `StatusCycleButton` (trocar status inline) e `DeleteTaskButton` quando
   `isAdmin` (delete direto da subtarefa). Isso NÃO é escopo novo — é a
   paridade que vem de graça ao reaproveitar o componente existente em vez de
   reimplementar uma versão só-leitura.
   — Mutação que este AC mata: manter `countSubtasks` calculado e não
   renderizado (estado atual) — precisa reprovar.
2. WHEN a tarefa aberta NÃO tem subtarefas THEN a seção de subtarefas SHALL
   ser omitida (não renderizar bloco vazio).
   — Mutação que este AC mata: sempre renderizar o bloco "Subtarefas" mesmo
   com lista vazia.
3. WHEN o usuário clica numa subtarefa da lista inline THEN o app SHALL
   navegar pra edição daquela subtarefa (link padrão do `TaskListItem`, sem
   comportamento novo).
   — Mutação que este AC mata: renderizar a lista com um componente custom
   sem `href` (regressão ao reimplementar em vez de reaproveitar
   `TaskListItem`).

> Nota: "tarefa que já é subtarefa não pode ter filhas" é invariante do
> trigger `enforce_task_parent` (hierarquia de 1 nível), não um caso a
> testar aqui — a query de subtarefas de uma subtarefa já retorna vazio por
> construção do dado, e cai no AC2 (seção omitida quando vazia). Listar
> como AC separado seria decorativo: nenhuma mutação plausível o derrubaria
> sem já derrubar AC2.

**Independent Test**: abrir a tarefa-pai com subtarefas conhecidas e ver a
lista delas; abrir uma tarefa-pai sem filhos e confirmar que a seção não
aparece.

---

## Edge Cases

- WHEN a pessoa filtrada (P) não tem NENHUMA tarefa atribuída THEN `/tasks`
  SHALL mostrar lista vazia (sem erro de sintaxe no filtro — o lookup de ids
  de P precisa de guarda pra lista vazia, já que `.or("id.in.(),...")` é
  inválido no PostgREST).
- WHEN a Operação da tarefa-pai está arquivada THEN a subtarefa continua
  seguindo a mesma regra de `operation.archived_at IS NULL` já aplicada hoje
  (não pode vazar tarefa de Operação arquivada só porque herdou visibilidade
  do pai).
- WHEN a subtarefa tem responsável PRÓPRIO que também é P THEN ela aparece
  pelo caminho normal (match direto), sem herança — AC2 já cobre que
  responsável próprio (mesmo P) não passa pela regra de herança, só pelo
  match direto que já existe hoje. Risco de linha duplicada é de
  implementação (ex: duas queries mescladas em JS), não do `.or()` de coluna
  única do PostgREST em si — quem implementar com duas queries precisa
  deduplicar por `id` antes de retornar.
- WHEN pai e filha têm `frente_id` diferentes ou a filha é tarefa de área
  (`area_id NOT NULL`, `frente_id NULL`, Inv. 15) THEN essa combinação SHALL
  seguir impossível de alcançar pelos formulários (`enforce_task_parent`
  barra frente diferente quando ambos os lados têm `frente_id`; nenhum form
  de tarefa de área oferece `parent_task_id`) — não é caso a tratar na
  correção, é invariante existente que a implementação NÃO deve contornar
  (ex: não remover a checagem de frente do trigger pra "simplificar").

## Success Criteria

- [ ] Cenário do bug relatado (tarefa-pai minha + subtarefa sem responsável)
      reproduzido manualmente ANTES do fix (reprova) e DEPOIS do fix (passa).
- [ ] `countTasks` e `listTasks` concordam em contagem sob os 3 filtros
      (open/done/all) × responsável=eu, responsável=outro, Todos (abaixo do
      teto de `TASKS_PAGE_LIMIT`).
- [ ] Nenhuma subtarefa com responsável próprio Q≠P vaza pro filtro "eu"
      (Story1 AC2), nem subtarefa órfã de pai alheio (Story1 AC3).
- [ ] Herança de visibilidade sobrevive à tarefa-pai estar `done` (Story1
      AC5) — subtarefa aberta continua na aba "Abertas".
- [ ] Abrir `.../tasks/[tid]/edit` de uma tarefa-pai com subtarefas mostra a
      lista delas na mesma página (Story2 AC1).
- [ ] Abrir `.../tasks/[tid]/edit` de uma tarefa sem subtarefas não mostra
      bloco vazio de "Subtarefas" (Story2 AC2).
