# status-acionavel-polish Tasks

**Design**: `.specs/features/status-acionavel-polish/design.md`

---

## Execution Plan

```
Phase 1 — Schema:
  T1 (migration: index parcial em frentes.actionable_status_since)

Phase 2 — Helper + Component reutilizável:
  T2 (utils/staleness.ts)
  T3 (ui/StalenessPill.tsx)

Phase 3 — Queries:
  T4 (queries/frentes.ts: listFrentesNeedingAttention + countHotCriticalFrentes)

Phase 4 — Integrações UI:
  T5 (FrentesAttentionSection no /)
  T6 (FrentesListSection: adicionar StalenessPill)
  T7 (Sidebar: badge global; (app)/layout.tsx fetcha count)
  T8 (FrenteForm: hint "Atualizado há Xd" em edit)

Phase 5 — Ship:
  T9 (typecheck + build + smoke)
  T10 (DATABASE_SCHEMA.md)
  T11 (issue + PR + merge)
```

Caminho crítico: T1→T2→T4→T5→T9→T11. ~30-40min (feature menor).

---

## Task Breakdown

### T1: Migration `<ts>_idx_frentes_actionable_status_since.sql`

**Done when**:
- [ ] Index parcial `idx_frentes_actionable_status_since_active` em `frentes(actionable_status_since ASC) WHERE archived_at IS NULL`
- [ ] Aplicado via MCP

---

### T2: Helper

- [ ] `src/lib/utils/staleness.ts`:
  - `STALENESS_THRESHOLDS` const
  - `StalenessLevel` type
  - `daysSince`, `stalenessLevel`, `stalenessLabel`, `isHotOrCritical`

---

### T3: StalenessPill component

- [ ] `src/components/ui/StalenessPill.tsx`:
  - Server-renderable
  - Props `{ since: string | null | undefined }`
  - Retorna null se fresh; senão Pill com text+variant do `stalenessLabel`

---

### T4: Queries

- [ ] `src/lib/db/queries/frentes.ts` adiciona:
  - `FrenteAttentionItem` type
  - `listFrentesNeedingAttention(limit = 8)` — filter + embed operation+client+responsible + ORDER + LIMIT
  - `countHotCriticalFrentes()` — head only, WHERE archived_at IS NULL AND actionable_status_since < now() - interval '14 days'

---

### T5: FrentesAttentionSection na Home

- [ ] `src/components/domain/FrentesAttentionSection.tsx`:
  - Server; props `frentes`, `hotCriticalCount`
  - Header h2 "Frentes pedindo atenção" + Pill contagem hot+critical
  - Lista linhas: Avatar (se responsible) + nome Frente Link + Op name Link + Pill cycle + StalenessPill + preview actionable_status 80 chars
  - Empty state
- [ ] `src/app/(app)/page.tsx`:
  - Promise.all com query + count
  - Renderiza `<FrentesAttentionSection />`
  - Onde encaixar: antes do que já existe (verificar layout atual)

---

### T6: FrentesListSection com pill

- [ ] Adicionar `<StalenessPill since={f.actionableStatusSince} />` no item
- [ ] Verificar nome do field na query existente (se for camelCase ou snake_case)

---

### T7: Sidebar badge

- [ ] `Sidebar.tsx` aceita `hotCriticalCount?: number`
- [ ] Renderiza Pill critical "{count}" (ou "9+" se >= 10) se > 0
- [ ] `src/app/(app)/layout.tsx`:
  - Promise.all com user + countHotCriticalFrentes()
  - Passa pro Sidebar

---

### T8: FrenteForm hint

- [ ] `FrenteForm.tsx` em mode edit, ao lado do label "Status acionável":
  - `<span>Atualizado há {daysSince(initialData.actionable_status_since)}d</span>`
  - Opcional: `<StalenessPill since={...} />`

---

### T9: Typecheck + build + smoke

- [ ] typecheck + build verdes
- [ ] Smoke:
  - Home mostra Frentes paradas com pill apropriada
  - /operations/[id] mostra pills inline nas Frentes
  - Sidebar mostra badge com count global
  - Edit form mostra hint "Atualizado há Xd"
  - Atualizar status da Frente → after refresh, pills somem; counter decresce

---

### T10: DATABASE_SCHEMA.md

- [ ] Mencionar novo index parcial sob `frentes`
- [ ] Migration na lista
- [ ] Última análise = 2026-05-17

---

### T11: Issue + commit + PR + merge

---

## Pre-Impl

Pace: reto T1→T9, pauso antes do PR. ~30-40min.
