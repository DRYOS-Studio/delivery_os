# tasks-multi-assignee-subtasks Design

## Estratégia de PRs

Duas partes independentes → **2 PRs stacked** sob 1 issue, na ordem:
1. **PR-A: múltiplos responsáveis** (junção + drop coluna + queries/actions/forms/list).
2. **PR-B: subtarefas** (self-FK + trigger + form + render aninhado).

Reviewável e revertível separadamente. Cada um com sua migration.

---

## PARTE A — Múltiplos responsáveis (todos iguais)

### Schema (migration `*_task_assignees.sql`)

```sql
CREATE TABLE IF NOT EXISTS public.task_assignees (
  task_id   uuid NOT NULL,
  person_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_task_assignees PRIMARY KEY (task_id, person_id),
  CONSTRAINT fk_task_assignees_task_id   FOREIGN KEY (task_id)   REFERENCES public.tasks(id)   ON DELETE CASCADE,
  CONSTRAINT fk_task_assignees_person_id FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE CASCADE
);
COMMENT ON TABLE public.task_assignees IS
  'frente: responsáveis (N:N) de uma tarefa, todos iguais (sem principal). Substitui tasks.assignee_person_id.';

CREATE INDEX IF NOT EXISTS idx_task_assignees_person ON public.task_assignees(person_id);

-- Backfill antes de dropar a coluna
INSERT INTO public.task_assignees (task_id, person_id)
SELECT id, assignee_person_id FROM public.tasks
WHERE assignee_person_id IS NOT NULL
ON CONFLICT DO NOTHING;

DROP INDEX IF EXISTS public.idx_tasks_assignee;
ALTER TABLE public.tasks DROP COLUMN IF EXISTS assignee_person_id;

-- RLS espelha tasks (via task→frente→operation)
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
-- policies SELECT/INSERT/UPDATE/DELETE com:
--   EXISTS (SELECT 1 FROM tasks t JOIN frentes f ON f.id=t.frente_id
--           WHERE t.id = task_assignees.task_id AND public.can_see_operation(f.operation_id))
```

> ON DELETE CASCADE em ambos os FKs: deletar a task OU a pessoa limpa a junção. Coerente com o atual `ON DELETE SET NULL` da coluna (pessoa removida → some da task), só que agora some a linha de junção.

### Queries (`src/lib/db/queries/tasks.ts`)
- `TaskRow`: trocar `assigneePersonId/assigneeName` por `assignees: { id: string; name: string }[]`.
- Embeds:
  - **Não filtrado** (display de todos): `assignees:task_assignees ( person:persons!fk_task_assignees_person_id (id, name) )`.
  - **Filtrado por pessoa** (`/tasks` e counts): `assignees:task_assignees!inner(...)` + `.eq("assignees.person_id", X)` — o `!inner` poda as linhas top-level pras que têm aquela pessoa (e o avatar group fica restrito à pessoa filtrada — aceitável, você filtrou por ela).
- `listTasks`, `countTasks`, `countMyOpenTasks`: filtro `eq("assignee_person_id", X)` → embed `!inner` + `eq("assignees.person_id", X)`.
- Mappers: `assignees = (row.task_assignees ?? []).map(a => a.person)` (achatar to-many).
- ⚠️ **Validar o shape do select aninhado/duplo contra o banco vivo via Supabase MCP** antes de fechar — PostgREST é chato com aliases pro mesmo FK.

### Actions (`src/lib/actions/tasks.ts`)
- `parseFormData`: `assignee_person_id` (single) → `assignee_person_ids` (lê `formData.getAll("assignee_person_ids")`).
- create/update: depois do insert/update de `tasks`, sincronizar junção:
  - create: `insert` das linhas em `task_assignees`.
  - update: `delete` das antigas + `insert` das novas (diff simples; volume baixo).
- Falha na sync da junção → `dbErr`. (Sem transação multi-statement no client Supabase; ordem: task primeiro, junção depois; erro na junção retorna erro tipado.)

### Validators (`src/lib/validators/task.ts`)
- `assignee_person_id: optionalUuid` → `assignee_person_ids: z.array(z.string().uuid()).optional()` (default `[]`).

### UI
- **TaskForm / TaskQuickCreateForm**: `<select>` single → multi-select de responsáveis (checkboxes ou `<select multiple>`; usar lista de checkboxes estilizada pro DS, mais usável que multiple nativo).
- **TaskListItem / MyTaskListItem**: avatar único → grupo de avatares (stack com overlap, +N quando >3). `MyTaskListItem` (modo "Todos") mostra nomes concatenados ou contagem.

---

## PARTE B — Subtarefas (1 nível, pai→filho)

### Schema (migration `*_task_subtasks.sql`)

```sql
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS parent_task_id uuid NULL;
ALTER TABLE public.tasks
  ADD CONSTRAINT fk_tasks_parent_task_id FOREIGN KEY (parent_task_id)
    REFERENCES public.tasks(id) ON DELETE CASCADE;
ALTER TABLE public.tasks
  ADD CONSTRAINT check_tasks_not_self_parent
    CHECK (parent_task_id IS NULL OR parent_task_id <> id);

COMMENT ON COLUMN public.tasks.parent_task_id IS
  'Subtarefa: aponta pra tarefa pai. NULL = top-level. Hierarquia trava em 1 nível e mesma Frente (trigger enforce_task_parent). ON DELETE CASCADE: deletar pai apaga subtarefas.';

CREATE INDEX IF NOT EXISTS idx_tasks_parent
  ON public.tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
```

### Trigger `enforce_task_parent` (BEFORE INSERT OR UPDATE)
Quando `NEW.parent_task_id IS NOT NULL`:
1. pai existe (`SELECT ... FROM tasks WHERE id = NEW.parent_task_id`), senão `RAISE`.
2. pai é top-level: `parent.parent_task_id IS NULL`, senão `RAISE` (barra >1 nível).
3. pai na mesma Frente: `parent.frente_id = NEW.frente_id`, senão `RAISE`.
4. a própria task não pode ter filhos (senão viraria nível 2): `NOT EXISTS (SELECT 1 FROM tasks WHERE parent_task_id = NEW.id)`, senão `RAISE`.

> CASCADE escolhido (vs SET NULL): deletar a tarefa pai apaga a quebra dela. Tasks não são auditadas (não são Decisões), então perda controlada é aceitável e casa com o modelo mental.

### Queries
- `TaskRow`: add `parentTaskId: string | null`. Incluir `parent_task_id` nos SELECTs e mappers.
- `listTasksByFrente`: continua retornando flat (pais + subtarefas). Agrupamento é client-side.
- Novo helper `listEligibleParents(frenteId, excludeTaskId?)`: top-level tasks da Frente (`parent_task_id IS NULL`) que não tenham filhos OU já sejam pais (ambos elegíveis como pai) — exclui a própria task em edição. Alimenta o select "Tarefa-pai".

### Actions
- create/update aceitam `parent_task_id` (optionalUuid). Trigger faz a validação dura; action só repassa. Erro do trigger volta como `dbErr` (mensagem do Postgres) — mapear pra mensagem amigável quando `code` indicar.

### UI
- **TaskForm**: novo campo opcional "Tarefa-pai" (select de `listEligibleParents`). Em modo "+ subtarefa", pré-preenchido (e travado).
- **TasksSection**: agrupa client-side — top-level em ordem atual; cada subtarefa renderiza indentada logo abaixo do pai. Pai ganha contador `m/n subtarefas`. Atalho "+ subtarefa" no row do pai → `/tasks/new?parent=<id>`.
- **MyTaskListItem / `/tasks`**: subtarefas aparecem flat (sem nesting), como hoje.

---

## Docs a atualizar (contrato)
- `docs/DATABASE_SCHEMA.md`: +`task_assignees`, coluna `parent_task_id`, drop `assignee_person_id`, contagem do módulo, data.
- CLAUDE.md "Invariantes": registrar (a) tasks N:N responsáveis via junção, (b) hierarquia 1 nível + mesma Frente. (Avaliar — pode ir só no DATABASE_SCHEMA pra não inflar.)
- STATE.md: AD novo pra cada decisão.

## Riscos
- **PostgREST select duplo/aliased** pro mesmo FK pode dar erro de embedding ambíguo → validar contra banco vivo (MCP) cedo no PR-A.
- **Filtro com `!inner` poda o avatar group** pra pessoa filtrada — decisão consciente, documentar.
- Drop de `assignee_person_id` é irreversível pós-merge — backfill obrigatório ANTES do drop, na mesma migration.
