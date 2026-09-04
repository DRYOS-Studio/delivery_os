# Tasks — Visibilidade de subtarefas

T1. **`tasks.ts`: herança de visibilidade em `listTasks`**
   - `resolveAssignedTaskIds(supabase, personId)`, `filterInheritedRows` (fail-closed, `assigneeLinks`).
   - `crossFrenteSelect`: remove parâmetro `inner`/docblock antigo; embed de exibição sempre completo (sem `!inner`, sem `.eq("assignees.person_id")`) + embed dedicado `assigneeLinks:task_assignees(person_id)`.
   - `listTasks`: guard de lista vazia (D1.2); `.or()` só quando `assigneePersonId`; `filterInheritedRows` antes do map; `.limit(TASKS_PAGE_LIMIT)` preservado.
   - Verify: `npm run typecheck` passa; `/code-review` no diff da task.

T2. **`tasks.ts`: `countTasks` reescrito (D2)**
   - `COUNT_SELECT` com `assigneeLinks` + `operation!inner(archived_at)`; `CountJoinedRow` + cast.
   - 1 query (sem `.limit`) + partição `isOpenStatus`/`done` em JS, substitui `Promise.all` de 3.
   - Verify: `npm run typecheck`; `/code-review`.

T3. **`tasks.ts`: `listSubtasksOf` + remove `countSubtasks`**
   - `listSubtasksOf(parentTaskId): Promise<TaskRow[]>` — mesmo padrão/ordenação de `listTasksByFrente`, filtro `parent_task_id = id`.
   - Remove `countSubtasks` (sem call-site após T4).
   - Verify: `npm run typecheck`; grep confirma zero referências a `countSubtasks` fora da task.

T4. **`edit/page.tsx`: lista de subtarefas inline**
   - Troca `countSubtasks(tid)` por `listSubtasksOf(tid)` (só quando `task.parentTaskId === null`); `childCount = subtasks.length`.
   - Seção "Subtarefas" condicional (`subtasks.length > 0`), reaproveita `TaskListItem` (`isSubtask`, `isAdmin` do `profile` já buscado).
   - Verify: `npm run typecheck`; `/code-review`; `Agent(validate-gate)` (UI).

T5. **`docs/workflows/tarefas.md`: reconciliação**
   - Atualiza os 5 trechos listados no design (assignee filter, mecanismo de `countTasks`, status via `isOpenStatus`, "só mostra m/n", `parent_task_id` não filtrado).
   - Verify: grep `countTasks|assignee=|subtarefa|parent_task_id` no arquivo, cada ocorrência bate com o código pós-fix.

T6. **Verificação manual (Independent Tests da spec)**
   - Cenário AC1/AC2/AC3/AC5 do Story1 + AC1/AC2 do Story2, via `/verify` (rodar o app) — não há test runner no repo.
   - Verify: cada cenário do spec.md reproduzido manualmente, resultado registrado no handoff da Fase 4.5.
