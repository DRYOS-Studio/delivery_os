# minhas-tasks Design

**Spec**: `.specs/features/minhas-tasks/spec.md`

---

## Decisão central: vínculo usuário→pessoa

Opções consideradas:
- **(A) Match por email em runtime** — `persons.email == auth.user.email`. Zero config, mas frágil: Pessoa sem email (ex: Gabi no seed) fica de fora; homônimos quebram.
- **(B) Coluna explícita `profiles.person_id`** ✅ escolhida — fonte da verdade, à prova de homônimo, gerenciável. Backfill por email cobre o caso comum sem trabalho manual.

Escolhida (B). Email entra só no backfill da migration, não em runtime.

`person_id` mora em `profiles` (não em `persons`) porque a cardinalidade natural é "um login → uma pessoa", e `profiles` é 1:1 com `auth.users`. `ON DELETE SET NULL`: apagar a Pessoa não apaga o login.

## Camada de dados

### Migration `20260529160001_profile_person_link.sql` (já aplicada)
- `ADD COLUMN person_id`, FK nomeada, index parcial, COMMENT, backfill por email.

### auth/server.ts
- `ProfileLite` ganha `personId: string | null`.
- `getProfile()` passa a selecionar `role, person_id`.
- Impacto: callers existentes (`Sidebar`, pages) continuam compilando — só leem `.role`/`.user`. Campo novo é aditivo.

### queries/tasks.ts
- Novo tipo `MyTaskRow` = `TaskRow` + `frenteName`, `operationId`, `operationName`, `clientName`.
- `listMyTasks(personId, filter)`: select tasks com join aninhado
  `frente:frentes!fk_tasks_frente_id ( name, operation:operations!fk_frentes_operation_id ( id, name, client:clients!fk_operations_client_id ( name ) ) )`.
  Filtra `assignee_person_id = personId`; aplica filtro de status (`open` → in todo/doing/blocked; `done` → eq done; `all` → sem filtro). Ordena por status (abertas primeiro), due_date asc nulls last, created_at desc.
- `countMyOpenTasks(personId)`: count head, `assignee_person_id = personId AND status in (todo,doing,blocked)`.
- Ambas retornam vazio/0 se `personId` for null (guard no caller; query não é chamada com null).

## Camada de UI

### Componente `MyTaskListItem.tsx` (server)
- Deriva do `TaskListItem`, mas: assignee sai (é sempre o usuário); entra linha de contexto `Operação · Cliente · Frente`.
- Título linka pra `/operations/[operationId]/frentes/[frenteId]/tasks/[id]/edit` (mesma rota de edição da Frente).
- Reusa `StatusCycleButton`, `Pill`, helper de due_date (extraído ou duplicado mínimo).

### Componente `MyTasksList.tsx` (server)
- Recebe `tasks`, `filter`, counts. Renderiza tabs (reusa padrão do `TasksSection`, base path `/me/tasks`) + lista ou empty state.

### Página `/me/tasks/page.tsx` (server)
- `requireProfile()` → se `personId` null, renderiza PageHeader + empty state "vincule sua pessoa".
- Senão, `Promise.all([listMyTasks, countMyOpenTasks, countDone, countAll])` conforme filtro; passa pro `MyTasksList`.
- `searchParams.filter` default `open`.

### Nav
- `SidebarNav`: leaf "Minhas Tasks" (`ListChecks`) no workspace group, após Home, com `count`.
- `Sidebar`: busca `countMyOpenTasks(profile.personId)` quando há `personId`; passa `myTasksCount` pro nav.

## Reuso vs duplicação
- `StatusCycleButton`, `Pill`, `Avatar`, `PageHeader` reusados as-is.
- due_date pill: lógica pequena; duplicar no `MyTaskListItem` em vez de extrair util agora (3 linhas, sem ganho de abstração).

## Riscos
- Usuário sem `person_id` (ex: novo signup sem email casado) → empty state guia. Não quebra.
- Join aninhado triplo: Supabase suporta; tipar com cast `as unknown as Row[]` igual ao resto de `tasks.ts`.
