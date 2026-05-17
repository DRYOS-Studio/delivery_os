# operation-villains Tasks

**Design**: `.specs/features/operation-villains/design.md`

---

## Execution Plan

```
Phase 1 — Schema:
  T1 (migration: enum + tabela + trigger write-once + RLS + index)
  T2 (regenerate types)

Phase 2 — Foundations:
  T3 (utils/severity.ts)
  T4 (validators/operation-villain.ts)
  T5 (queries/operation-villains.ts + listAvailableVillains)

Phase 3 — Actions:
  T6 (actions/operation-villains.ts: assign/update/delete)

Phase 4 — Components:
  T7 (VillainProgressBar + helpers visuais)
  T8 (OperationVillainsSection + OperationVillainRow + AssignVillainForm + EditOperationVillainForm + RemoveOperationVillainButton)
  T9 (PublicVillainsList)

Phase 5 — Integrações:
  T10 (substituir placeholder em /operations/[id])
  T11 (adicionar section em /public/[token])

Phase 6 — Ship:
  T12 (typecheck + build + smoke + verificar trigger SQL)
  T13 (DATABASE_SCHEMA.md)
  T14 (issue + PR + merge)
```

Caminho crítico: T1→T2→T5→T6→T8→T10→T12→T14. ~75-90min.

---

## Task Breakdown

### T1: Migration `<ts>_operation_villains.sql`

**Done when**:
- [ ] DO $$ CREATE TYPE severity_level (idempotente)
- [ ] CREATE TABLE operation_villains com colunas + 4 constraints (FKs + UNIQUE + CHECK progress + CHECK evidence length)
- [ ] Index (operation_id, created_at DESC)
- [ ] COMMENT ON TABLE + COMMENT ON COLUMN initial_severity
- [ ] Function `lock_operation_villain_initial_severity` (RAISE EXCEPTION com ERRCODE check_violation)
- [ ] Trigger BEFORE UPDATE
- [ ] Trigger updated_at
- [ ] RLS + policy authenticated_full
- [ ] Aplicado via MCP

---

### T2: Regenerate types

- [ ] generate_typescript_types MCP
- [ ] `operation_villains` Row + Insert + Update; enum `severity_level`

---

### T3: utils/severity.ts

- [ ] `SeverityLevel` type
- [ ] `SEVERITY_LABEL` + `SEVERITY_VARIANT` maps
- [ ] `progressVariant(pct)` — sage/ok/oak/warning

---

### T4: Validators

- [ ] `src/lib/validators/operation-villain.ts`:
  - `progressInput` preprocess
  - `optionalEvidence` preprocess
  - `assignVillainSchema` (villain_id, initial_severity, progress_pct, evidence)
  - `editOperationVillainSchema` (progress_pct + evidence só)

---

### T5: Queries

- [ ] `src/lib/db/queries/operation-villains.ts`:
  - `OperationVillainListItem` type (com villain embedded)
  - `listVillainsByOperation(operationId)` — JOIN villain; sort progress DESC + severity DESC
  - `getOperationVillain(id)` — pra edit/delete
  - `listPublicVillains(operationId)` — usa createAdmin; mesma shape
  - `listAvailableVillains(operationId)` — villains ativos NOT IN current

---

### T6: Actions

- [ ] `src/lib/actions/operation-villains.ts`:
  - `assignVillainAction(operationId, formData)` — guard + assignVillainSchema + INSERT + map 23505 → already_assigned
  - `updateOperationVillainAction(id, formData)` — guard + editSchema + getOperationVillain (op_id) + UPDATE sem initial_severity + map check_violation → severity_locked
  - `deleteOperationVillainAction(id)` — guard + getOperationVillain + DELETE
  - revalidatePath /operations/[id]

---

### T7: VillainProgressBar

- [ ] `src/components/domain/VillainProgressBar.tsx`:
  - Server; props: pct, height? (default sm)
  - Renderiza div com gradient oak→sage proporcional a pct
  - Pill ou span com {pct}%

---

### T8: Section + Row + Forms + RemoveButton

- [ ] `OperationVillainRow.tsx` server — props: item, operationId, availableVillains
- [ ] `AssignVillainForm.tsx` client — RHF + zodResolver(assignVillainSchema); select villain, select severity, textarea evidence
- [ ] `EditOperationVillainForm.tsx` client — RHF + zodResolver(editOperationVillainSchema); progress + evidence (severity readonly hint)
- [ ] `RemoveOperationVillainButton.tsx` client — × + window.confirm + delete action
- [ ] `OperationVillainsSection.tsx` server — props: items, availableVillains, operationId; header + Pill contagem + AssignForm collapsible + lista Row

---

### T9: PublicVillainsList

- [ ] `src/components/domain/PublicVillainsList.tsx` — server; props: items
- [ ] Header + Pill contagem
- [ ] Cada item: Icon + nome + quote + Pill severity (com "Severidade inicial: ALTA") + Pill progress big + barra + description (catalog)
- [ ] Sem evidence (interno); sem botões

---

### T10: Integrar em /operations/[id]

- [ ] Promise.all adiciona:
  - listVillainsByOperation(id)
  - listAvailableVillains(id)
- [ ] Substitui PlaceholderSection "Vilões em luta" por `<OperationVillainsSection ... />`
- [ ] Posiciona ANTES de FrentesListSection (era o lugar do placeholder)

---

### T11: Integrar em /public/[token]

- [ ] Promise.all adiciona listPublicVillains(operationId)
- [ ] Renderiza `<PublicVillainsList items={villains} />` após PublicFrentesList, antes de PublicTimeline

---

### T12: Typecheck + build + smoke

- [ ] Build verde (rotas 36 — sem novas)
- [ ] Smoke:
  - Acme/Core: atribuir Manualis severity=high → aparece com barra 0%
  - Editar Manualis → progress 35% → barra reflete
  - Tentar UPDATE de initial_severity via SQL direto → check_violation
  - Remover Manualis → some + volta ao select
  - Atribuir Silos + Achismo + Drenador → ordering por progress DESC
  - Public link Acme: section visível com narrativa
- [ ] Screenshots: section, assign form, edit row, public list

---

### T13: DATABASE_SCHEMA.md

- [ ] Adicionar `operation_villains` (15ª tabela)
- [ ] Adicionar enum `severity_level` na lista de enums
- [ ] Mencionar Inv. 07 (trigger write-once) + Inv. 08 (CHECK progress)
- [ ] Migration na lista

---

### T14: Issue + commit + PR + merge

---

## Pre-Impl

Pace: reto T1→T12, pauso antes do PR. ~75-90min.

**Riscos**:
- Trigger SQL — testar smoke manual antes de PR
- VillainProgressBar gradient — pode precisar ajuste de cor em dark mode (futuro v2)
- Public ordering: archive de villain durante luta — UI deve renderizar mesmo arquivado
