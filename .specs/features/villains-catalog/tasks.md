# villains-catalog Tasks

**Design**: `.specs/features/villains-catalog/design.md`

---

## Execution Plan

```
Phase 1 — Schema:
  T1 (migration: tabela + seed 7 + RLS + trigger + 3 CHECKs)
  T2 (regenerate types)

Phase 2 — Foundations:
  T3 (validators/villain.ts + constants/villain-icons.ts)
  T4 (queries/villains.ts)

Phase 3 — Actions:
  T5 (actions/villains.ts: update + archive + restore — sem create/delete)

Phase 4 — Components:
  T6 (VillainCard server)
  T7 (VillainForm client + ArchiveVillainButton)

Phase 5 — Pages:
  T8 (reescrever /catalog/page.tsx com grid)
  T9 (/catalog/villains/[id]/edit/page.tsx)

Phase 6 — Ship:
  T10 (typecheck + build + smoke)
  T11 (DATABASE_SCHEMA.md)
  T12 (issue + PR + merge)
```

Caminho crítico: T1→T2→T4→T5→T6→T8→T10→T12. ~50min.

---

## Task Breakdown

### T1: Migration `<ts>_villains_catalog.sql`

**Done when**:
- [ ] CREATE TABLE villains com colunas (id, name, slug UNIQUE, quote, description, icon_name, pill_variant, display_order UNIQUE, archived_at, created_at, updated_at)
- [ ] 3 CHECKs (pill_variant enum, slug regex, display_order > 0)
- [ ] 2 indexes (display_order + parcial archived_at IS NULL)
- [ ] COMMENT ON TABLE + 2 COMMENT ON COLUMN
- [ ] 7 INSERTs com `ON CONFLICT (slug) DO NOTHING`
- [ ] Trigger updated_at
- [ ] RLS habilitado
- [ ] 3 policies: SELECT, INSERT, UPDATE (sem DELETE — Inv. 06)
- [ ] Aplicado via MCP

---

### T2: Regen types

- [ ] MCP generate_typescript_types
- [ ] `villains` Row + Insert + Update types

---

### T3: Validators + icon constants

- [ ] `src/lib/validators/villain.ts`:
  - PILL_VARIANTS const
  - villainSchema com 7 campos
  - VillainInput / VillainOutput types
- [ ] `src/lib/constants/villain-icons.ts`:
  - 20 ícones lucide
  - `VILLAIN_ICONS` map
  - `VillainIconName` type
  - `resolveVillainIcon(name)` com fallback HelpCircle

---

### T4: Queries

- [ ] `src/lib/db/queries/villains.ts`:
  - `VillainListItem` type
  - `listVillains()` — ORDER BY (archived_at IS NULL) DESC, display_order ASC
  - `getVillain(id)` — retorna Row

---

### T5: Actions

- [ ] `src/lib/actions/villains.ts`:
  - `updateVillainAction(id, formData)` — guard + Zod + UPDATE + map 23505 → validation_slug
  - `archiveVillainAction(id)` — guard + UPDATE archived_at=now()
  - `restoreVillainAction(id)` — guard + UPDATE archived_at=NULL
  - revalidatePath /catalog
  - **Sem** create / delete

---

### T6: VillainCard component

- [ ] `src/components/domain/VillainCard.tsx`:
  - Server; props: villain
  - Renderiza: Icon (via resolveVillainIcon) com bg do variant, name (Funnel Display), quote (italic), description (text-mute), Pill com slug, Link "Editar →"
  - Se archived_at: opacity-60 + Pill "Arquivado"

---

### T7: VillainForm + ArchiveVillainButton

- [ ] `src/components/domain/VillainForm.tsx`:
  - Client; RHF + zodResolver(villainSchema)
  - Inputs: name, slug, quote, description (textarea), icon_name (select com VILLAIN_ICONS keys), pill_variant (select), display_order (number)
  - Submit → updateVillainAction → router.push /catalog
- [ ] `src/components/domain/ArchiveVillainButton.tsx`:
  - Client; props: id, archivedAt
  - Renderiza "Arquivar" ou "Restaurar" baseado em archivedAt
  - window.confirm + action correspondente
  - router.refresh()

---

### T8: /catalog/page.tsx reescrita

- [ ] Substitui PlaceholderSection
- [ ] Promise.all listVillains
- [ ] PageHeader "Catálogo" subtitle "Universo de marca: os 7 vilões da ineficiência"
- [ ] Grid responsivo (1/2/3 cols por breakpoint)
- [ ] Renderiza VillainCard pra cada vilão

---

### T9: Edit page

- [ ] `src/app/(app)/catalog/villains/[id]/edit/page.tsx`:
  - UUID guard
  - getVillain → redirect /catalog se null
  - PageHeader "Editar — {name}"
  - VillainForm + ArchiveVillainButton

---

### T10: Typecheck + build + smoke

- [ ] Build verde (rotas 35 + 1 = 36)
- [ ] Smoke:
  - /catalog mostra 7 cards
  - Click Editar Manualis → form pré-preenchido
  - Mudar quote → save → reflete em /catalog
  - Arquivar Drenador → fica com opacity + Pill "Arquivado"
  - Restaurar → volta
- [ ] Screenshots: grid, edit form, archived state

---

### T11: DATABASE_SCHEMA.md

- [ ] Adicionar `villains` (14ª tabela)
- [ ] Mencionar Inv. 06 + sem policy DELETE
- [ ] Migration na lista

---

### T12: Issue + commit + PR + merge

---

## Pre-Impl

Pace: reto T1→T10, pauso antes do PR. ~50min.
