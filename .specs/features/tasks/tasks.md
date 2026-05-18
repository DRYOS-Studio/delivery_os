# tasks Tasks

**Design**: `.specs/features/tasks/design.md`

---

## Execution Plan

```
Phase 1 — Schema:
  T1 (migration: enum + table + 4 FKs + 2 indexes + 2 triggers + RLS)
  T2 (regenerate types)

Phase 2 — Domain layer:
  T3 (queries/tasks.ts: list, get, countOpen × 2)
  T4 (validators/task.ts: Zod schema)
  T5 (actions/tasks.ts: create, update, changeStatus, delete)

Phase 3 — UI components:
  T6 (StatusCycleButton client)
  T7 (TaskListItem server + DeleteTaskButton client)
  T8 (TasksSection server)
  T9 (TaskForm client)
  T10 (FrenteMetaCard server)

Phase 4 — Pages:
  T11 (/operations/[id]/frentes/[fid]/page.tsx — Frente detail)
  T12 (/operations/[id]/frentes/[fid]/tasks/new/page.tsx)
  T13 (/operations/[id]/frentes/[fid]/tasks/[tid]/edit/page.tsx)
  T14 (FrentesListSection: name vira Link pra detail page)

Phase 5 — Painel admin:
  T15 (DashboardCountsGrid: 5º card; layout 5 col responsive; page busca countAllOpenTasks)

Phase 6 — Ship:
  T16 (DATABASE_SCHEMA.md atualizado)
  T17 (typecheck + build + smoke preview + SQL verify trigger)
  T18 (issue + PR + merge)
```

Caminho crítico: T1→T2→T3→T5→T7→T8→T11→T17→T18. Paralelo possível: T4↔T6, T10↔T9. ~90-120min.

---

## Task Breakdown

### T1: Migration `<ts>_tasks.sql`

- [ ] Enum `task_status` (todo/doing/blocked/done) — idempotente (DO $$ ... IF NOT EXISTS)
- [ ] CREATE TABLE tasks com todos os campos do design
- [ ] FKs: fk_tasks_frente_id (CASCADE), fk_tasks_assignee_person_id (SET NULL), fk_tasks_quick_win_id (SET NULL), fk_tasks_sla_incident_id (SET NULL)
- [ ] CHECK title length >= 3
- [ ] COMMENT ON TABLE + COMMENT ON COLUMN (completed_at, tags)
- [ ] Indexes: idx_tasks_frente_status, idx_tasks_assignee (partial)
- [ ] Trigger set_tasks_updated_at usando set_updated_at fn existente
- [ ] Function + Trigger manage_task_completed_at (BEFORE INSERT OR UPDATE)
- [ ] RLS habilitado + policy tasks_authenticated_full
- [ ] Aplicado via MCP `apply_migration`

---

### T2: Regenerate types

- [ ] MCP `generate_typescript_types`
- [ ] Confirmar `Database["public"]["Tables"]["tasks"]` + `Database["public"]["Enums"]["task_status"]`

---

### T3: queries/tasks.ts

- [ ] Type `TaskStatus` (re-export do db.ts ou alias)
- [ ] Type `TaskRow` (camelCase)
- [ ] `listTasksByFrente(frenteId)`:
  - SELECT com join `assignee:persons!left(id, full_name)`
  - ORDER BY: `CASE WHEN status='done' THEN 1 ELSE 0 END` ASC, `due_date` ASC NULLS LAST, `created_at` DESC
  - Map row → TaskRow
- [ ] `getTask(id)` — single, com mesmo join
- [ ] `countOpenTasksByFrente(frenteId)` — count head:true, status IN (todo,doing,blocked)
- [ ] `countAllOpenTasks()` — count head:true, status IN (todo,doing,blocked); INNER join frentes pra excluir frentes archived. Sem join: status IN (...); + filter `frentes.archived_at IS NULL` via select com `frentes!inner(archived_at)`. Aceitar simplificação: por ora só count by status (frente archived é raro).

---

### T4: validators/task.ts

- [ ] `taskStatusSchema` z.enum([...])
- [ ] `taskSchema`:
  - title: z.string().trim().min(3, "Título deve ter pelo menos 3 caracteres")
  - description: z.string().nullable()
  - status: taskStatusSchema
  - assignee_person_id: z.string().uuid().nullable()
  - due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()
  - tags: z.array(z.string().trim().min(1).max(30)).nullable()
  - quick_win_id: z.string().uuid().nullable()
  - sla_incident_id: z.string().uuid().nullable()

---

### T5: actions/tasks.ts

- [ ] `formDataToTaskInput(formData)` helper (split tags por vírgula, trim, dedup, filter empty)
- [ ] `createTaskAction(frenteId, formData)`:
  - requireUserAction
  - Zod validation
  - INSERT
  - revalidatePath `/operations/[id]/frentes/[fid]` (precisa do operationId; query frente.operation_id antes)
  - revalidatePath `/operations/[id]`
  - revalidatePath `/admin/dashboard`
- [ ] `updateTaskAction(id, formData)` — similar
- [ ] `changeTaskStatusAction(id, newStatus)`:
  - requireUserAction
  - Validate newStatus enum
  - UPDATE
  - revalidate apenas operations/* relevantes
- [ ] `deleteTaskAction(id)`:
  - requireAdminAction
  - DELETE
  - revalidates

---

### T6: StatusCycleButton client

- [ ] `src/components/domain/StatusCycleButton.tsx`
- [ ] Props: taskId, currentStatus
- [ ] Visual por status:
  - todo: square outline (Square icon)
  - doing: filled circle ou half-square (CircleDashed)
  - done: CheckSquare verde
  - blocked: AlertOctagon laranja (não-clicável; só edita via form)
- [ ] onClick (exceto blocked): next status: todo→doing, doing→done, done→todo
- [ ] useTransition pending state
- [ ] Toast em err

---

### T7: TaskListItem + DeleteTaskButton

- [ ] `TaskListItem.tsx` (server):
  - Grid 12-col: status icon (1) + title link (5) + assignee (2) + due_date pill (2) + tags (1) + delete (1)
  - Title linka pra `/operations/[id]/frentes/[fid]/tasks/[tid]/edit`
  - Avatar com initials se assignee, "—" se null
  - Due date pill: warning se atrasada, oak se ≤ 3 dias, neutral se > 3, sem pill se null. Função helper `dueDatePill(due, status)`: se status='done' retorna null (esconde).
  - Tags: render até 2; "+N" pill se mais
- [ ] `DeleteTaskButton.tsx` (client):
  - Padrão: window.confirm + action + toast em err
  - Recebe taskId

---

### T8: TasksSection

- [ ] `TasksSection.tsx` (server)
- [ ] Header h2 "Tarefas" + Pill count + filter tabs + "+ Nova" button
- [ ] Filter tabs: 3 Links com search param `?filter=open|done|all`
- [ ] Body: ul de TaskListItems
- [ ] Empty state com CTA

---

### T9: TaskForm

- [ ] `TaskForm.tsx` (client, "use client")
- [ ] useForm com defaultValues do task se edit
- [ ] Server action passada como prop
- [ ] Campos:
  - title (Input)
  - description (Textarea)
  - status (Select; ocultar default na criação)
  - assignee_person_id (Select de Persons; passa lista do servidor)
  - due_date (Input type=date)
  - tags (Input texto; helper "separe por vírgula")
  - quick_win_id (Select; opcional; lista props)
  - sla_incident_id (Select; opcional; lista props)
- [ ] Submit: FormData; chama action; redirect se ok

---

### T10: FrenteMetaCard

- [ ] `FrenteMetaCard.tsx` (server)
- [ ] Header com nome, cycle Pill, domain Pill, phase Pill
- [ ] Actionable status + StalenessPill
- [ ] Responsible (Avatar + name) ou —
- [ ] Link "Editar Frente →" pra `/operations/[id]/frentes/[fid]/edit` (visível pra todos; já existe a página)

---

### T11: Frente detail page

- [ ] `src/app/(app)/operations/[id]/frentes/[fid]/page.tsx`
- [ ] requireUser
- [ ] params + searchParams await
- [ ] Promise.all: getFrenteDetail (existente? — se não, criar), listTasksByFrente, listQuickWinsByOperation, listSlaIncidentsByOperation (se existe), listPersonsForAssignment (todas internas ativas)
- [ ] PageHeader com backHref `/operations/[id]`
- [ ] FrenteMetaCard
- [ ] applyTaskFilter helper
- [ ] TasksSection

---

### T12: tasks/new page

- [ ] `/operations/[id]/frentes/[fid]/tasks/new/page.tsx`
- [ ] requireUser
- [ ] Fetch persons + quickWins + incidents da operação
- [ ] TaskForm em modo create
- [ ] Action `createTaskAction.bind(null, fid)`

---

### T13: tasks/[tid]/edit page

- [ ] `/operations/[id]/frentes/[fid]/tasks/[tid]/edit/page.tsx`
- [ ] requireUser
- [ ] getTask(tid) — notFound se null ou frente_id !== fid
- [ ] TaskForm em modo edit
- [ ] Action `updateTaskAction.bind(null, tid)`
- [ ] DeleteTaskButton no rodapé se isAdmin

---

### T14: FrentesListSection update

- [ ] Editar `FrentesListSection.tsx`
- [ ] Nome da Frente vira `<Link href={`/operations/${operationId}/frentes/${f.id}`}>...</Link>`
- [ ] Manter "Editar →" no fim como link separado

---

### T15: Painel admin update

- [ ] `DashboardCountsGrid.tsx`:
  - Adicionar prop `openTasks`
  - Layout: `grid-cols-2 md:grid-cols-3 lg:grid-cols-5`
  - 5º MetricCard "Tarefas abertas" com variant condicional
- [ ] `getDashboardSummary` em `queries/dashboard.ts`:
  - Adicionar `openTasks: number` ao type
  - Adicionar fetch count em Promise.all
- [ ] `/admin/dashboard/page.tsx`: passar `openTasks` pro grid

---

### T16: DATABASE_SCHEMA.md

- [ ] Adicionar tabela `tasks` (20ª) na seção apropriada (frente module?)
- [ ] Adicionar enum `task_status`
- [ ] Adicionar migration na lista
- [ ] Última análise = 2026-05-17

---

### T17: Build + smoke + SQL verify

- [ ] `npm run build` verde
- [ ] Preview smoke como admin:
  - Acessar `/operations/[id]` → nome Frente é link
  - Clicar → vai pra detail page
  - Section "Tarefas" visível, empty state
  - Criar primeira task via "+ Nova" — title obrigatório, valida
  - Lista mostra task; cycle button funciona (todo → doing → done)
  - completed_at SQL check: após done, valor presente; após voltar pra todo, NULL
  - Delete admin funciona
  - Filtro tabs Abertas/Concluídas/Todas
- [ ] Painel admin: card "Tarefas abertas" reflete count
- [ ] SQL verify:
  ```sql
  INSERT INTO tasks (frente_id, title, status) VALUES ('<uuid>', 'test', 'done');
  SELECT completed_at FROM tasks WHERE title='test'; -- not null
  UPDATE tasks SET status='todo' WHERE title='test';
  SELECT completed_at FROM tasks WHERE title='test'; -- null
  DELETE FROM tasks WHERE title='test';
  ```
- [ ] Member smoke (se possível): create OK, delete bloqueado, status cycle OK

---

### T18: Issue + PR + merge

- [ ] gh issue create
- [ ] commit imperativo
- [ ] gh pr create com `Closes #N`

---

## Pre-Impl

Pace: reto T1→T17, pauso antes do PR. ~90-120min.

**Riscos:**
- T11 `getFrenteDetail`: pode não existir; tem `getFrente` que retorna row. Verificar e criar wrapper com operationId.
- T11 `listSlaIncidentsByOperation`: precisa confirmar nome real da função; se não existe, criar.
- T6 cycle UX: 4 estados (todo/doing/blocked/done) num cycle único é confuso. Decisão MVP: cycle pula blocked; só status form muda pra blocked.
- T1 trigger: BEFORE INSERT trigger acessa OLD que é NULL — usar TG_OP para distinguir.
- T5 `revalidatePath` precisa do operationId pro template; chamar query frente.operation_id antes da revalidate. Cuidado: server actions com revalidate dinâmico.
- T15 layout grid: 5 cards em lg pode ficar apertado; verificar visual.
- T9 tags input UX: comma-separated é simples mas user pode digitar com espaço. Trim + dedup resolve.
- T17 SQL verify trigger: precisa frente_id real; pegar via SELECT id FROM frentes LIMIT 1.
