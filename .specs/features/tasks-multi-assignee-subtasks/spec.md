# tasks-multi-assignee-subtasks Specification

## Problem Statement

A feature `tasks` (MVP) foi entregue com duas limitações deliberadas que agora viram dor real:

1. **1 responsável só** (`assignee_person_id`). Tarefa tocada por dupla obriga duplicar a task ou usar Alocação ampla — nenhum dos dois reflete "fulano e ciclana tocam ISTO".
2. **Sem subtarefas/dependências.** Tarefa grande não se quebra em passos rastreáveis dentro da própria Frente; a saída antiga ("vira Frente nova") é pesada demais pro caso comum.

Pedido do usuário, com restrição explícita: **não complicar**.

## Decisões fechadas (com o usuário)

- **Múltiplos responsáveis = todos iguais.** Sem "responsável principal". N:N puro.
- **Relação entre tarefas = subtarefas (hierarquia pai→filho).** NÃO dependências (A bloqueia B). Escolhido por ser mais simples e intuitivo.

## Goals

### Parte A — Múltiplos responsáveis
- [ ] Tabela de junção `task_assignees (task_id, person_id)` PK composto, ambos FK CASCADE.
- [ ] Backfill: cada `tasks.assignee_person_id` não-nulo vira 1 linha em `task_assignees`.
- [ ] **Drop** da coluna `tasks.assignee_person_id` (fonte única — sem coluna derelita).
- [ ] RLS na junção espelha o gating de `tasks` (via task→frente→operation, `can_see_operation`).
- [ ] Form (TaskForm + TaskQuickCreateForm): seleção múltipla de responsáveis.
- [ ] Filtro `/tasks` por pessoa passa a casar "pessoa está entre os responsáveis".
- [ ] List items mostram grupo de avatares (todos os responsáveis).
- [ ] `countMyOpenTasks(personId)` conta tarefas onde a pessoa é um dos responsáveis.

### Parte B — Subtarefas
- [ ] Coluna `tasks.parent_task_id uuid NULL` self-FK `ON DELETE CASCADE`.
- [ ] CHECK anti-self-parent (`parent_task_id IS NULL OR parent_task_id <> id`).
- [ ] Trigger `enforce_task_parent`: hierarquia **só 1 nível** (pai não pode ser subtarefa; subtarefa não pode ter filhos) + pai na **mesma Frente**.
- [ ] Form: campo opcional "Tarefa-pai" (lista tarefas top-level da mesma Frente).
- [ ] Atalho "+ subtarefa" numa tarefa pai (pré-preenche o pai).
- [ ] `TasksSection` (dentro da Frente) renderiza subtarefas aninhadas/indentadas sob o pai, com contador "m/n subtarefas concluídas".

## Out of Scope

- **Dependências entre tarefas (A bloqueia B)** — descartado a favor de subtarefas.
- **Responsável principal / papéis distintos** — todos iguais.
- **Hierarquia >1 nível** — sem subtarefa de subtarefa. Trigger barra.
- **Rollup de status** — pai NÃO completa sozinho quando filhas terminam; status independentes. UI só mostra contador.
- **Aninhamento de subtarefas na visão cross-Frente `/tasks`** — lá aparecem flat (são itens de agenda legítimos), com o contexto de Frente já existente. Sem nesting no MVP.
- **Reordenar/drag, recorrência, comentários, anexos por task, audit log** — inalterado do spec original.
- **Public link** — tasks continuam internas; nada muda em `/public/[token]`.

## Invariantes tocadas / novas

- Mantém Inv. de família: `frente_id NOT NULL`. Subtarefa também tem `frente_id` (= da pai, garantido por trigger).
- Nova regra dura: **subtarefa e pai sempre na mesma Frente** (trigger).
- Nova regra dura: **hierarquia de tarefa é no máximo 1 nível** (trigger).
- RLS habilitado na nova tabela `task_assignees` na mesma migration (Inv. 12).

## User Stories

### P1: Múltiplos responsáveis ⭐
Como membro, quero marcar mais de uma pessoa como responsável por uma tarefa, pra refletir trabalho em dupla sem duplicar a task. A tarefa aparece em "Tasks" de cada pessoa marcada.

### P2: Subtarefas ⭐
Como membro, quero quebrar uma tarefa em subtarefas dentro da mesma Frente, cada uma com seu próprio responsável/prazo/status, vendo quantas já concluí.
