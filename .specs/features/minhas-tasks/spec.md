# minhas-tasks Specification

## Problem Statement

A feature `tasks` (#feat/tasks) entregou tarefas por Frente, mas listou explicitamente no Out of Scope:

> **/tasks cross-Frente view** — out do MVP. Section por Frente cobre o caso comum. View agregada por assignee fica pra v2.

Esta feature realiza esse v2. Hoje o usuário só vê suas tarefas navegando Frente a Frente dentro de cada Operação. Não existe um "o que eu tenho pra fazer" agregado.

Bloqueador resolvido: até agora `tasks.assignee_person_id → persons` não tinha vínculo com o usuário autenticado (`profiles`/`auth.users`). Sem esse link, "minhas" tarefas é indefinível.

## Goals

- [x] Coluna `profiles.person_id` (FK → persons, ON DELETE SET NULL) liga usuário autenticado à sua Pessoa interna. Backfill por email no momento da migration.
- [ ] Página "Minhas Tasks" em `/me/tasks` lista todas as tasks onde `assignee_person_id = profile.person_id`, agregadas de todas as Frentes/Operações.
- [ ] Default: só tarefas abertas (`todo`/`doing`/`blocked`). Filtro por tabs `Abertas` / `Concluídas` / `Todas` (mesmo padrão do `TasksSection`).
- [ ] Cada item mostra contexto cross-Frente: Operação + Cliente + Frente (o assignee é sempre o próprio usuário, então sai da linha).
- [ ] Reaproveita `StatusCycleButton` pra mudar status inline.
- [ ] Item nav "Minhas Tasks" no grupo Espaço de trabalho, com count de abertas.
- [ ] Empty state quando o usuário não tem `person_id` vinculado (orienta a vincular).
- [ ] DATABASE_SCHEMA.md atualizado (nova coluna em `profiles`).

## Out of Scope

- **Editar o vínculo `person_id` pela UI** — gerenciado por admin via backfill/SQL no MVP (RLS de `profiles` UPDATE já é admin-only). Tela de gestão fica pra depois.
- **Tarefas criadas por mim / observadas por mim** — `tasks` não tem campo `creator`. "Minhas" = atribuídas a mim. Só.
- **Agrupamento por Operação/Frente na página** — lista plana ordenada por status + due_date cobre o caso comum. Agrupamento visual é polish futuro.
- **Filtro por due_date / tags / texto** — fora do MVP desta página. Tabs de status cobrem o essencial.
- **Match por email em runtime** — descartado em favor do link explícito `person_id` (decisão do usuário). Email só alimenta o backfill da migration.
- **Tarefas de Pessoas externas** — só faz sentido pra usuário interno; assignee externo não tem login.

---

## User Stories

### P1: Link usuário→pessoa ⭐ MVP

Como usuário autenticado, quero que o sistema saiba qual Pessoa eu sou, pra poder listar minhas tarefas.

**Acceptance Criteria**:
1. `profiles.person_id uuid` nullable, FK `fk_profiles_person_id → persons(id) ON DELETE SET NULL`.
2. Index parcial `idx_profiles_person_id WHERE person_id IS NOT NULL`.
3. Backfill: profiles cujo email do auth.user casa (case-insensitive) com uma Pessoa interna não-arquivada recebem `person_id`.
4. RLS inalterado: SELECT all authenticated, UPDATE admin-only.

### P2: Página Minhas Tasks ⭐ MVP

Como usuário, quero ver todas as minhas tarefas abertas num lugar só.

**Acceptance Criteria**:
1. Rota `/me/tasks` autenticada.
2. Lista tasks onde `assignee_person_id = profile.person_id`, default só abertas.
3. Tabs `Abertas` / `Concluídas` / `Todas` via `?filter=`.
4. Cada item: título (link pra edit da task na Frente), pill de due_date, Operação · Cliente · Frente, `StatusCycleButton`.
5. Empty states: sem person_id vinculado → orienta; com vínculo mas sem tasks no filtro → mensagem neutra.

### P3: Navegação ⭐ MVP

Como usuário, quero acessar Minhas Tasks pela sidebar.

**Acceptance Criteria**:
1. Leaf "Minhas Tasks" no grupo Espaço de trabalho, ícone Lucide funcional (`ListChecks`).
2. Pill neutra com count de tarefas abertas minhas (escondida se 0 ou sem vínculo).
