# minhas-tasks Tasks

**Design**: `.specs/features/minhas-tasks/design.md`

---

## Execution Plan

```
Phase 1 — Data (DONE):
  T1 ✅ migration: profiles.person_id + FK + index + backfill por email
  T2 ✅ regenerate types

Phase 2 — Domain layer:
  T3 auth/server.ts: ProfileLite.personId + getProfile select person_id
  T4 queries/tasks.ts: MyTaskRow, listMyTasks(personId, filter), countMyOpenTasks(personId)

Phase 3 — UI:
  T5 MyTaskListItem.tsx (server)
  T6 MyTasksList.tsx (server)
  T7 /me/tasks/page.tsx (server, filter via searchParams, empty states)
  T8 SidebarNav + Sidebar: leaf "Minhas Tasks" com count

Phase 4 — Ship:
  T9 DATABASE_SCHEMA.md: coluna person_id em profiles
  T10 typecheck + commit + PR
```

## Status
- T1–T10: completos. Migration aplicada no Supabase remoto, types regerados, typecheck + build verdes, query validada via SQL com dados reais.
- Pendência fora de escopo: vincular `person_id` dos users reais (`rafael@dryos.com.br`, `gabriela@dryos.studio`) — hoje NULL, veem empty state. Ver AD-010 no STATE.md.
