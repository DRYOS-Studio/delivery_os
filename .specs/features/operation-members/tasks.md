# Tasks: operation-members

**Spec:** [spec.md](./spec.md) · **Design:** [design.md](./design.md) · **Issue:** [#80](https://github.com/rafaelemeth/delivery_os/issues/80)
**Status:** TASKS (Phase 1 detalhada; 2 e 3 esboço)

---

## Branch & PR

- **Branch Phase 1:** `feat/operation-members-core`
- **PR-A title:** `feat: operation-members core (scope visibility by operation)`
- **PR body inclui:** `Closes #80` (fechado só no PR-C; A e B usam `Refs #80`)

---

## Phase 1 — Núcleo (PR-A)

### T1 — Confirmar `requireAdmin()` / `requireAdminAction()` em `lib/auth/server.ts`
- Ler `src/lib/auth/server.ts` atual.
- Se já existem ambos com a assinatura do design: skip.
- Se faltam: adicionar `requireAdmin()` (Server Component, redirect/notFound) e `requireAdminAction()` (Server Action, retorna `ActionResult`).
- **Verificação:** typecheck.

### T2 — Migration `20260526190001_operation_members_scope.sql`
- Em `supabase/migrations/`.
- Conteúdo na ordem:
  1. `CREATE TABLE operation_members` + index `(operation_id)` + COMMENT.
  2. `ENABLE ROW LEVEL SECURITY` em `operation_members`.
  3. Policy `om_admin_all` + `om_member_select_self`.
  4. `CREATE OR REPLACE FUNCTION is_admin()` + REVOKE/GRANT.
  5. `CREATE OR REPLACE FUNCTION can_see_operation(uuid)` + REVOKE/GRANT.
  6. Para cada tabela direta (operations, frentes, briefings, meetings, decisions, attachments, operation_villains, operation_villain_narratives, quick_wins, operation_costs, public_links): `DROP POLICY IF EXISTS <atual>` + criar `<tabela>_scoped_select` (USING) + `<tabela>_scoped_insert` (WITH CHECK) + `<tabela>_scoped_update` (USING + WITH CHECK) + `<tabela>_scoped_delete` (USING). Expressão = `public.can_see_operation(operation_id)` ou `public.can_see_operation(id)` pra operations.
  7. `allocations` e `tasks`: USING via JOIN com frentes (vide design.md "Expressões de visibilidade").
- Aplicar via MCP `apply_migration`.
- **Verificação:** rodar `SELECT public.is_admin();` e `SELECT public.can_see_operation(<algum_id>);` com SQL editor.

### T3 — Regenerar types
- MCP `generate_typescript_types` → `src/lib/db/types.ts`.
- **Verificação:** typecheck deve mostrar `operation_members` em `Database['public']['Tables']`.

### T4 — Query `lib/db/queries/operation-members.ts`
- `listOperationMembers(operationId)` — join com profiles.
- `listAssignableProfiles(operationId)` — 2 queries + diff em memória (vide design).
- **Verificação:** typecheck.

### T5 — Server Actions `lib/actions/operation-members.ts`
- `addOperationMemberAction({operation_id, profile_id})`.
- `removeOperationMemberAction({operation_id, profile_id})`.
- Ambas com `requireAdminAction()` no topo.
- `revalidatePath` em `/operations/[id]/settings/members` e `/operations`.
- **Verificação:** typecheck. Smoke via SQL: simular admin chamando insert/delete.

### T6 — Page `/operations/[id]/settings/members/page.tsx`
- Server Component, `requireAdmin()`.
- Layout: PageHeader + lista + formulário de adicionar.
- Sem estado vazio elaborado (mensagem "Nenhum membro atribuído" basta).
- **Verificação:** build verde, render local.

### T7 — Component `OperationMembersList.tsx` (server)
- Em `src/components/domain/`.
- Grid `[2rem_1fr_auto]` (avatar inicial · nome+role pill · botão Remover).
- Botão Remover dentro de `<form action={removeOperationMemberAction.bind(null, {...})}>`.
- **Verificação:** render.

### T8 — Component `AddOperationMemberForm.tsx` (client)
- `useTransition`.
- `<select>` populado por prop `candidates`.
- Mensagem de erro inline; sucesso só recarrega.
- **Verificação:** smoke local — admin adiciona, lista atualiza.

### T9 — Link "Members" no header de `/operations/[id]/page.tsx`
- Somente quando `profile.role === 'admin'`.
- Adicionar ao lado dos outros links em `actions=`.
- **Verificação:** member não vê o link.

### T10 — Smoke + PR
- Build + typecheck local.
- Commit com mensagem clara em inglês.
- Push.
- `gh pr create` com `Refs #80`.
- **Verificação manual via Vercel preview:**
  - Admin Rafael adiciona Gabriel a uma Op de teste.
  - Gabriel recarrega `/operations` — vê só essa Op.
  - Gabriel tenta URL de Op não dele → 404 / RLS bloqueia.
  - Rafael remove Gabriel — Gabriel recarrega → vê 0.
- Atualizar `.specs/project/STATE.md` (current work).

---

## Phase 2 — Cascata (PR-B) · esboço

- **Branch:** `feat/operation-members-cascade`
- Migration `20260527XXXXXX_operation_members_scope_indirect.sql`:
  - RLS rewrite em `clients`, `persons` (caso interna E externa numa única policy SELECT), `profiles` (refined).
- Validar `lib/db/queries/clients.ts`, `persons.ts`, painel queries.
- Estados vazios diferenciados em `/clients`, `/persons`, `/` (painel) — copy: "Você ainda não foi atribuído a nenhuma Operação. Peça pra um admin."
- Smoke completo (admin vê tudo, member vê só do agrupamento).
- PR-B body: `Refs #80`.

---

## Phase 3 — Polish (PR-C) · esboço

- **Branch:** `feat/operation-members-polish`
- Revisar Server Actions de mutação em operações/frentes/etc — mapear 0-rows pós-mutate como `not_found` (R1).
- 404 vs 403 nos route handlers — escolher 404 (não revela existência).
- Badge "X operações atribuídas" em algum lugar útil (perfil, header — TBD).
- Docs:
  - `.specs/project/ROADMAP.md` → seção Bônus: `operation-members (#80 / PRs A+B+C)`.
  - `docs/DATABASE_SCHEMA.md` → adicionar `operation_members` no módulo auth/scope.
  - `.claude/skills/dryos-conventions/SKILL.md` → seção "RLS scoped por Operação" com pattern do helper.
- PR-C body: `Closes #80`.

---

## Estimativa

- **Phase 1:** ~3-4h se nada quebrar. Maior risco: alguma Server Action quebrar e precisar de retoque em paralelo.
- **Phase 2:** ~2h. Mais simples (3 policies + smoke).
- **Phase 3:** ~1-2h (mais texto que código).

---

## Definition of Done (feature inteira)

- [ ] Member com 0 atribuições vê listas vazias com copy específica.
- [ ] Admin atribui/remove via UI sem problema.
- [ ] Member não acessa Operação fora do agrupamento (404).
- [ ] Catálogos seguem globais.
- [ ] Painel KPIs refletem escopo.
- [ ] Build + typecheck verde.
- [ ] Zero console error em smoke E2E.
- [ ] Docs centrais atualizadas (ROADMAP, DATABASE_SCHEMA, SKILL).
- [ ] `STATE.md` reflete COMPLETE.
- [ ] Issue #80 fechada via PR-C.
