# diagnostico-quickwins Tasks

**Design**: `.specs/features/diagnostico-quickwins/design.md`

---

## Execution Plan

```
Phase 1 — Schema:
  T1 (migration: enum + 3 tabelas + ALTER + 2 triggers + RLS + updated_at)
  T2 (regenerate types)

Phase 2 — Foundations:
  T3 (validators: diagnostic + quick-win)
  T4 (queries: diagnostics + quick-wins + update operations.ts pra incluir diagnostic_id)

Phase 3 — Actions:
  T5 (actions/diagnostics: upsert)
  T6 (actions/quick-wins: create/update/delete + best-effort rollback)
  T7 (atualizar OperationForm + validator + action pra diagnostic_id)

Phase 4 — Components:
  T8 (DiagnosticForm + ClientDiagnosticSection)
  T9 (QuickWinForm com useFieldArray + QuickWinRow + QuickWinsSection)
  T10 (PublicAchievementsList)
  T11 (EditOperationVillainForm: remover progress_pct input)

Phase 5 — Pages:
  T12 (/clients/[id]/diagnostic/edit)
  T13 (integrar ClientDiagnosticSection em /clients/[id])
  T14 (integrar QuickWinsSection em /operations/[id])
  T15 (integrar PublicAchievementsList em /public/[token])

Phase 6 — Ship:
  T16 (typecheck + build + smoke + verify triggers SQL)
  T17 (DATABASE_SCHEMA.md)
  T18 (issue + PR + merge)
```

Caminho crítico: T1→T2→T4→T6→T9→T14→T16→T18. ~120-150min (maior feature do MVP).

---

## Task Breakdown

### T1: Migration `<ts>_diagnostico_quickwins.sql`

**Done when**:
- [ ] DO $$ CREATE TYPE product_recommendation (idempotente)
- [ ] CREATE TABLE diagnostics + UNIQUE(client_id) + CHECK notes length 10-10000 + FK CASCADE
- [ ] ALTER operations ADD diagnostic_id + FK SET NULL idempotente + COMMENT
- [ ] CREATE TABLE quick_wins + 3 FKs (op CASCADE, frente SET NULL, executor auth.users SET NULL) + 2 CHECKs (title/description)
- [ ] CREATE TABLE quick_win_impacts + 2 FKs CASCADE + UNIQUE(qw, ov) + CHECK pct 1-100
- [ ] Index `idx_quick_wins_operation_happened`
- [ ] Index `idx_quick_win_impacts_operation_villain`
- [ ] COMMENT ON TABLE em todas
- [ ] Function `validate_quick_win_impact_sum` + trigger BEFORE INSERT OR UPDATE
- [ ] Function `sync_operation_villain_progress` + trigger AFTER INSERT OR UPDATE OR DELETE
- [ ] Triggers updated_at em diagnostics + quick_wins
- [ ] RLS habilitado nas 3 tabelas + policies authenticated_full
- [ ] Aplicado via MCP

---

### T2: Regenerate types

- [ ] MCP generate_typescript_types
- [ ] Types: diagnostics, quick_wins, quick_win_impacts Row + Insert + Update; enum product_recommendation; operations.diagnostic_id

---

### T3: Validators

- [ ] `src/lib/validators/diagnostic.ts`:
  - diagnosticSchema (notes, recommended_product optional, conducted_at optional)
- [ ] `src/lib/validators/quick-win.ts`:
  - impactSchema (operation_villain_id uuid, impact_pct coerce int 1-100)
  - quickWinSchema (title, description optional, happened_at, frente_id optional uuid, impacts array max 7)

---

### T4: Queries

- [ ] `src/lib/db/queries/diagnostics.ts`:
  - `DiagnosticRow` type
  - `getDiagnosticByClient(clientId)` — maybeSingle
- [ ] `src/lib/db/queries/quick-wins.ts`:
  - `QuickWinListItem` com impacts embedded (com villain join via operation_villain → villain)
  - `listQuickWinsByOperation(operationId)` — ORDER happened_at DESC; embed impacts + villain via 2 queries (impacts.operation_villain_id → ov → villain)
  - `getQuickWin(id)`
  - `listPublicQuickWins(operationId, limit=12)` via createAdmin
  - Executor email resolved via createAdmin auth.admin.getUserById
- [ ] Update `src/lib/db/queries/operations.ts`:
  - OperationDetail ganha `diagnosticId: string | null`
  - SELECT inclui diagnostic_id

---

### T5: Action diagnostics

- [ ] `src/lib/actions/diagnostics.ts`:
  - `upsertDiagnosticAction(clientId, formData)` — guard + Zod + UPSERT (ON CONFLICT client_id DO UPDATE)
  - revalidatePath /clients/[id]

---

### T6: Action quick-wins

- [ ] `src/lib/actions/quick-wins.ts`:
  - `createQuickWinAction(operationId, formData)`:
    - Guard + Zod parse
    - INSERT quick_win
    - Batch INSERT quick_win_impacts (cada um pode trigger Inv. 08)
    - Se algum impact falhar → DELETE quick_win pra rollback manual; map check_violation → impact_cap_exceeded
  - `updateQuickWinAction(qwId, formData)`:
    - Guard + getQuickWin
    - UPDATE qw fields
    - DELETE impacts existentes + INSERT novos
    - Map errors
  - `deleteQuickWinAction(qwId)`:
    - Guard + DELETE (CASCADE remove impacts; trigger sync recalcula progress)
  - revalidatePath /operations/[id]

---

### T7: OperationForm + diagnostic_id

- [ ] Update `src/lib/validators/operation.ts` adiciona `diagnostic_id` optional uuid
- [ ] Update `src/lib/actions/operations.ts` parse + UPDATE inclui diagnostic_id
- [ ] Update `OperationForm` aceita prop `clientDiagnosticId?: string` (resolve via cliente)
- [ ] Renderiza select/checkbox "Linkar a diagnóstico de {cliente}" se clientDiagnosticId disponível
- [ ] OperationDetail query inclui diagnostic_id (já T4)
- [ ] Page /operations/[id]/edit + /new fetcha diagnostic do cliente

---

### T8: DiagnosticForm + ClientDiagnosticSection

- [ ] `src/components/domain/DiagnosticForm.tsx` client RHF
- [ ] `src/components/domain/ClientDiagnosticSection.tsx` server:
  - Card com notes/produto se diagnóstico existe
  - Empty state + CTA → /clients/[id]/diagnostic/edit

---

### T9: QuickWinForm + Row + Section

- [ ] `src/components/domain/QuickWinForm.tsx` client:
  - RHF + zodResolver(quickWinSchema)
  - Campos: title, description, happened_at, frente_id select
  - useFieldArray pra impacts; cada linha: select operation_villain + input impact_pct + remove button
  - Botão "Adicionar impacto" append
  - Submit → action
- [ ] `src/components/domain/QuickWinRow.tsx` client (com toggle edit):
  - Display: title, description preview, executor, happened_at, chips de impacto (icon villain + name + +pct)
  - Toggle Editar → reusa QuickWinForm mode=edit
  - × remove
- [ ] `src/components/domain/QuickWinsSection.tsx` server:
  - Header h2 + Pill contagem + Button "Registrar"
  - Inline form collapsible
  - Lista QuickWinRow

---

### T10: PublicAchievementsList

- [ ] `src/components/domain/PublicAchievementsList.tsx` server:
  - Limit 12
  - Card cada: ícone sage CheckCircle + title + description preview + data relativa + chips de impacto sage

---

### T11: EditOperationVillainForm sem progress

- [ ] Remove input progress_pct + label
- [ ] Adiciona nota "Progresso derivado dos Quick Wins"
- [ ] evidence permanece
- [ ] Action `updateOperationVillainAction` NÃO inclui progress_pct no patch
- [ ] (Validator existente já permite — só remove o uso)

---

### T12: /clients/[id]/diagnostic/edit page

- [ ] UUID guard
- [ ] getClient + getDiagnosticByClient em paralelo
- [ ] PageHeader + DiagnosticForm

---

### T13: Integrar ClientDiagnosticSection em /clients/[id]

- [ ] Promise.all adiciona getDiagnosticByClient
- [ ] Renderiza `<ClientDiagnosticSection diagnostic clientId />`

---

### T14: Integrar QuickWinsSection em /operations/[id]

- [ ] Promise.all adiciona listQuickWinsByOperation
- [ ] Renderiza `<QuickWinsSection />` entre Vilões e Frentes
- [ ] Operation villains list já tem ov.id (necessário pra form impacts)

---

### T15: Integrar PublicAchievementsList em /public/[token]

- [ ] Promise.all adiciona listPublicQuickWins
- [ ] Renderiza após PublicVillainsList, antes de PublicFrentesList

---

### T16: Typecheck + build + smoke + verify triggers

- [ ] Build verde (rotas: 36 + 1 = 37)
- [ ] SQL smoke:
  - INSERT QW impact +50% em villain limpo → progress_pct=50
  - INSERT outro impact +30% no mesmo villain → progress_pct=80
  - INSERT outro impact +25% (sum=105) → check_violation
  - DELETE 1 impact → progress_pct recalcula
- [ ] UI smoke Acme/Core:
  - Criar diagnóstico
  - Linkar Op ao diagnóstico
  - Registrar QW "Automatizou WhatsApp" Manualis +18% Silos +5%
  - Verificar progress_pct atualizou
  - Tentar 2º QW Manualis +90% → erro
  - Public link mostra Conquistas + chips
- [ ] Screenshots

---

### T17: DATABASE_SCHEMA.md

- [ ] Adicionar 3 tabelas + enum
- [ ] Nota em operations sobre diagnostic_id
- [ ] Total 18 tabelas
- [ ] Migration na lista

---

### T18: Issue + commit + PR + merge

---

## Pre-Impl

Pace: reto T1→T16, pauso antes do PR. ~120-150min.

**Riscos**:
- Trigger Inv. 08 + sync interagindo — testar isoladamente SQL antes de UI
- useFieldArray + zodResolver — verificar comportamento client em re-render
- Transaction rollback manual no createQuickWinAction — caso impact rejeitar após QW INSERT
- OperationForm: carregar diagnostic do cliente exige extra fetch (current_client_id watcher RHF)
