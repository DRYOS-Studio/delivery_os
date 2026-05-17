# briefing-vivo Tasks

**Design**: `.specs/features/briefing-vivo/design.md`

---

## Execution Plan

```
Phase 1 — Schema:
  T1 (migration: briefings + briefing_versions + RLS + trigger + index)
  T2 (regenerate types)

Phase 2 — Foundations (paralelo):
  T3 (validators/briefing.ts + constants/briefing.ts)
  T4 (queries/briefings.ts: get/list/getVersion/getFreshness)

Phase 3 — Action:
  T5 (actions/briefings.ts: saveBriefingAction)

Phase 4 — Components:
  T6 (BriefingForm — RHF, 8 textareas)
  T7 (BriefingView — server, render seções)
  T8 (BriefingHistoryList — server)
  T9 (extender OperationHero com briefingFreshness Pill)

Phase 5 — Pages:
  T10 (/briefing — view atual ou empty)
  T11 (/briefing/edit)
  T12 (/briefing/history)
  T13 (/briefing/history/[vid])
  T14 (integrar OperationHero — /operations/[id] page passa freshness)

Phase 6 — Ship:
  T15 (typecheck + build + smoke + screenshots)
  T16 (DATABASE_SCHEMA.md update)
  T17 (issue + commit + push + PR + merge)
```

Caminho crítico: T1→T2→T4→T5→T6→T10/T11→T15→T17. ~45-60min.

---

## Task Breakdown

### T1: Migration `supabase/migrations/<ts>_briefing_vivo.sql`

**Done when**:
- [ ] `CREATE TABLE briefings` (id, operation_id UNIQUE NOT NULL FK CASCADE, current_version_id FK SET NULL, created_at, updated_at)
- [ ] `CREATE TABLE briefing_versions` (id, briefing_id FK CASCADE, 8 colunas text, author_id FK auth.users SET NULL, created_at)
- [ ] Index `idx_briefing_versions_briefing_created` em (briefing_id, created_at DESC)
- [ ] FK `fk_briefings_current_version_id` adicionada via ALTER após CREATE de briefing_versions (forward dep)
- [ ] `COMMENT ON TABLE` em ambas
- [ ] `COMMENT ON COLUMN briefings.current_version_id` explicando denormalização
- [ ] `ENABLE ROW LEVEL SECURITY` em ambas
- [ ] Policy `briefings_authenticated_full` (FOR ALL)
- [ ] Policies em briefing_versions: SELECT + INSERT only (sem UPDATE/DELETE = bloqueado)
- [ ] Trigger `set_briefings_updated_at` reusando função existente
- [ ] Aplicar via MCP `apply_migration`

---

### T2: Regenerate types

**Done when**:
- [ ] `npm run gen:types` (ou MCP `generate_typescript_types`)
- [ ] `src/lib/db/types.ts` contém `briefings` e `briefing_versions` Row types
- [ ] Commitado

---

### T3: `src/lib/validators/briefing.ts` + `src/lib/constants/briefing.ts`

**Done when**:
- [ ] `optionalText` preprocess + max(5000)
- [ ] `briefingSchema` com 8 campos optional
- [ ] `BriefingInput`/`BriefingOutput` exportados
- [ ] `BRIEFING_SECTIONS` const com 8 entries (key + label pt-BR)
- [ ] `BriefingSectionKey` type derivado

---

### T4: `src/lib/db/queries/briefings.ts`

**Done when**:
- [ ] Types: `BriefingContent`, `BriefingVersionRow`, `BriefingWithLatest`
- [ ] `getBriefingByOperation(operationId)`:
  - SELECT briefing + latestVersion (via current_version_id JOIN) + authorEmail (auth.users join)
  - Fallback: se current_version_id null, MAX(created_at) das versões
  - Count versions
  - Retorna null se não há briefing
- [ ] `getBriefingVersion(versionId)`: SELECT linha
- [ ] `listBriefingVersions(briefingId, limit=50)`: ORDER BY created_at DESC; com authorEmail
- [ ] `getBriefingFreshness(operationId)`: lightweight — só checa exists + updated_at

---

### T5: `src/lib/actions/briefings.ts`

**Done when**:
- [ ] `'use server'`; ActionResult
- [ ] `saveBriefingAction(operationId, formData)`:
  - Guard auth → capture user.id
  - Zod parse 8 campos
  - SELECT briefing existente por operation_id → se não existe, INSERT (RETURNING id); senão usa id
  - INSERT briefing_versions com 8 campos + author_id RETURNING id
  - UPDATE briefings SET current_version_id, updated_at=now()
  - revalidatePath de `/operations/[id]/briefing` (e variants)
  - ok({ operationId, versionId })
- [ ] Sem `throw`

---

### T6: `src/components/domain/BriefingForm.tsx`

**Done when**:
- [ ] `'use client'`; RHF + zodResolver(briefingSchema)
- [ ] Discriminated props: create/edit
- [ ] 8 textareas (rows=6, label em pt-BR, helper opcional)
- [ ] Submit → `saveBriefingAction(operationId, formData)`
- [ ] Em sucesso → `router.push(\`/operations/${operationId}/briefing\`)`
- [ ] Pattern busy = isSubmitting
- [ ] Error mapping (toast genérico se action retorna error sem field)

---

### T7: `src/components/domain/BriefingView.tsx`

**Done when**:
- [ ] Server component; props: `content: BriefingContent`
- [ ] Renderiza cada seção: `<section>` com `<h2>` (Funnel Display) + body `<p whitespace-pre-wrap>` ou empty fallback
- [ ] Ordem fixa via `BRIEFING_SECTIONS`

---

### T8: `src/components/domain/BriefingHistoryList.tsx`

**Done when**:
- [ ] Server component; props: `versions`, `currentVersionId`, `operationId`
- [ ] Lista cada versão: Pill data + Avatar(sm) + email autor + preview 120 chars + Link "Ver versão completa"
- [ ] Pill "Atual" sage na versão atual

---

### T9: Extender `OperationHero`

**Done when**:
- [ ] Aceita prop opcional `briefingFreshness?: { hasBriefing: boolean; updatedAt: string | null }`
- [ ] Renderiza Pill condicional:
  - `hasBriefing=false` → warning "Sem briefing"
  - `hasBriefing=true` → sage "Briefing vivo · atualizado há Xd" (via relativeFromNow)
- [ ] Link/CTA "→ Briefing" do lado

---

### T10: `src/app/(app)/operations/[id]/briefing/page.tsx`

**Done when**:
- [ ] UUID guard
- [ ] Promise.all(getOperation, getBriefingByOperation)
- [ ] Se op inválida redirect
- [ ] Se briefing null: empty state card + CTA "Criar briefing" → linka pra /edit
- [ ] Se briefing existe: PageHeader + "Atualizado em X por Y · Histórico (N)" + `<BriefingView content={latestVersion} />`
- [ ] Botão "Editar" sage no header

---

### T11: `src/app/(app)/operations/[id]/briefing/edit/page.tsx`

**Done when**:
- [ ] UUID guard
- [ ] Promise.all(getOperation, getBriefingByOperation)
- [ ] Op inválida → redirect
- [ ] Se op arquivada → redirect /briefing (readonly)
- [ ] Renderiza BriefingForm em mode create se briefing null, edit com initialData se existe
- [ ] PageHeader "Editar briefing"

---

### T12: `src/app/(app)/operations/[id]/briefing/history/page.tsx`

**Done when**:
- [ ] UUID guard
- [ ] Promise.all(getOperation, getBriefingByOperation)
- [ ] Op inválida → redirect /operations
- [ ] Briefing null → redirect /briefing
- [ ] listBriefingVersions(briefing.id)
- [ ] PageHeader "Histórico — Briefing"
- [ ] `<BriefingHistoryList />`

---

### T13: `.../briefing/history/[vid]/page.tsx`

**Done when**:
- [ ] UUID guard id + vid
- [ ] Promise.all(getOperation, getBriefingByOperation, getBriefingVersion(vid))
- [ ] Validar version.briefing_id === briefing.id; senão redirect /history
- [ ] PageHeader "Versão de {data} por {autor}"
- [ ] `<BriefingView content={version} />` em readonly + link "← Voltar pra histórico"

---

### T14: Integrar Hero em `/operations/[id]/page.tsx`

**Done when**:
- [ ] Page chama `getBriefingFreshness(id)` em paralelo
- [ ] Passa pra `<OperationHero briefingFreshness={...} />`

---

### T15: Typecheck + build + smoke + screenshots

**Done when**:
- [ ] typecheck + build verdes (rotas: 20 existentes + 4 novas = 24)
- [ ] Smoke local em Acme/Core:
  - Visita /briefing → empty state
  - Criar briefing com 3 seções → salva → redirect view
  - Ver hero da Op com pill "Briefing vivo · atualizado há 0d"
  - Editar → mudar 1 seção → save → history mostra 2 versões
  - Ver versão antiga → conteúdo diferente da atual
- [ ] Screenshots: empty state, edit form, view, history list, version readonly, hero atualizado

---

### T16: Atualizar `docs/DATABASE_SCHEMA.md`

**Done when**:
- [ ] Adicionar módulo "Briefing" com 2 tabelas
- [ ] Atualizar índice (total 5 → 7)
- [ ] Última análise = 2026-05-17

---

### T17: Issue + commit + push + PR + merge

**Done when**:
- [ ] gh issue criada (título + body)
- [ ] Commit imperativo
- [ ] Branch push
- [ ] PR `Closes #N`
- [ ] Merge squash
- [ ] Deploy verificado em delivery-os-phi.vercel.app

---

## Pre-Impl

Pace: reto T1→T15, pauso antes do T17/PR. ~45-60min.
