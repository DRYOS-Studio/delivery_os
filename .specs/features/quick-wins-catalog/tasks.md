# quick-wins-catalog Tasks

**Design**: `.specs/features/quick-wins-catalog/design.md`
**Status**: Draft

---

## Execution Plan

```
Phase 1 — Foundation (sequential)
  T1 (migration + 21 seeds) → T2 (regen types)

Phase 2 — Backend (parallel após T2)
  ├── T3 validator
  ├── T4 queries
  └── T5 server actions (depende de T3)

Phase 3 — Catalog UI (após T4/T5)
  ├── T6 ArchiveQuickWinCatalogButton (copy)
  ├── T7 QuickWinCatalogCard
  ├── T8 QuickWinCatalogForm
  ├── T9 page /catalog/quick-wins
  ├── T10 page /new
  └── T11 page /[id]/edit

Phase 4 — Sidebar + QW form (parallel após T4)
  ├── T12 SidebarNav adiciona "Quick Wins"
  └── T13 QuickWinForm select + auto-fill (após T4)
       └─ T14 wire em /operations/[id]/page.tsx + QuickWinsSection

Phase 5 — Validate + docs (sequential)
  T15 smoke E2E → T16 docs
```

---

## Task Breakdown

### T1: Migration `quick_win_catalog` + seed (21)

**What**: SQL criando tabela, CHECKs, UNIQUE case-insensitive, RLS, trigger, FK e 21 seeds.
**Where**: `supabase/migrations/<timestamp>_quick_win_catalog.sql`
**Depends on**: none
**Reuses**: padrões DRYOS (DO $$ IF NOT EXISTS, RLS authenticated_full, trigger).
**Tools**: Supabase MCP `apply_migration`.

**Done when**:
- [ ] Migration aplicada via MCP `success: true`
- [ ] `execute_sql` confirma: 21 rows; distribuição 3 por vilão; FK `fk_qwc_villain`; UNIQUE index `idx_qwc_title_unique_ci`
- [ ] Insert duplicado case-insensitive falha (23505); insert com title 2 chars falha (CHECK); insert com impact 101 falha (CHECK)

---

### T2: Regen types

**What**: `npm run gen:types`
**Depends on**: T1

**Done when**:
- [ ] `quick_win_catalog` em `Database.public.Tables`
- [ ] `npm run typecheck` passa

---

### T3: Validator `quickWinCatalogSchema` [P]

**Where**: `src/lib/validators/quick-win-catalog.ts` (novo)
**Depends on**: T2

**Done when**:
- [ ] Schema valida title (3-120 trim), description (opt ≤ 2000), suggested_villain_id (uuid opt), default_impact_pct (int 1-100 opt)
- [ ] Empty strings → undefined via `.or(z.literal(""))`
- [ ] Exporta `QuickWinCatalogInput` + `QuickWinCatalogOutput`
- [ ] `npm run typecheck` passa

---

### T4: Queries `quick-win-catalog.ts` [P]

**Where**: `src/lib/db/queries/quick-win-catalog.ts` (novo)
**Depends on**: T2

**Done when**:
- [ ] `listQuickWinCatalog()` retorna `QuickWinCatalogRow[]` ordenado title ASC
- [ ] `listActiveQuickWinCatalog()` retorna `QuickWinCatalogListItem[]` com join villain (id, name, slug, icon_name, pill_variant, archived_at), filtrado `archived_at IS NULL`
- [ ] `getQuickWinCatalogItem(id)` retorna row ou null
- [ ] Tipos `QuickWinCatalogRow` + `QuickWinCatalogListItem` exportados
- [ ] `npm run typecheck` passa

---

### T5: Server actions

**Where**: `src/lib/actions/quick-win-catalog.ts` (novo)
**Depends on**: T3
**Reuses**: padrão `service-products.ts`.

**Done when**:
- [ ] 4 actions: create/update/archive/restore
- [ ] `requireAdminAction` na primeira linha
- [ ] DB error mapping: 23505 → `title_conflict`, 23503 → `validation_suggested_villain_id`, 23514 → `check_violation`
- [ ] `revalidatePath('/catalog/quick-wins')` + edit path quando aplicável
- [ ] Retorna `ActionResult<{ id }>`
- [ ] `npm run typecheck` passa

---

### T6: `ArchiveQuickWinCatalogButton` [P após T5]

**Where**: `src/components/domain/ArchiveQuickWinCatalogButton.tsx` (novo)
**Reuses**: cópia direta de `ArchiveServiceProductButton`.

**Done when**:
- [ ] Confirm dialog + chama action correspondente
- [ ] Refresh + reload UI no sucesso
- [ ] `npm run typecheck` passa

---

### T7: `QuickWinCatalogCard` [P após T4]

**Where**: `src/components/domain/QuickWinCatalogCard.tsx` (novo)
**Depends on**: T4 (tipos), T6 (button)

**Done when**:
- [ ] Props: `{ item: QuickWinCatalogListItem; isAdmin: boolean }`
- [ ] Render: ícone genérico + título display + descrição truncada + pill do vilão (com ícone via `resolveVillainIcon`) + pill `+X%` se `defaultImpactPct`
- [ ] Vilão arquivado: pill mostra "(arquivado)"
- [ ] Botões admin (editar + archive) com border-top
- [ ] Card opacity-60 se item arquivado
- [ ] `npm run typecheck` passa

---

### T8: `QuickWinCatalogForm` [P após T3]

**Where**: `src/components/domain/QuickWinCatalogForm.tsx` (novo)
**Depends on**: T3, T5

**Done when**:
- [ ] Props discriminated `{ mode: 'create'; villains: VillainBrief[] }` | `{ mode: 'edit'; initialData; villains }`
- [ ] Campos: title (input), description (textarea), suggested_villain_id (select com 7 vilões + "—"), default_impact_pct (number 1-100)
- [ ] Submit chama action; OK → redirect `/catalog/quick-wins` + refresh
- [ ] Error mapping inline + general
- [ ] `npm run typecheck` passa

---

### T9: Página `/catalog/quick-wins`

**Where**: `src/app/(app)/catalog/quick-wins/page.tsx`
**Depends on**: T4, T7

**Done when**:
- [ ] Server component; chama `listQuickWinCatalog()` + monta map de villains por id (1 query separada de villains ou enriquece query)
- [ ] PageHeader título + botão "+ Adicionar tipo" (admin) + links "← Vilões" / "Produtos"
- [ ] Grid de ativos + seção colapsável de arquivados
- [ ] Não-admin vê listagem (sem botões edit/archive)
- [ ] `npm run typecheck` passa

---

### T10: Página `/catalog/quick-wins/new`

**Where**: `src/app/(app)/catalog/quick-wins/new/page.tsx`
**Depends on**: T8

**Done when**:
- [ ] Server component; verifica `isAdmin` via `getProfile`; `notFound()` se não
- [ ] Fetch vilões ativos via `listVillains()` (filtra archived no client)
- [ ] Renderiza `<QuickWinCatalogForm mode="create" villains={...} />`
- [ ] `npm run typecheck` passa

---

### T11: Página `/catalog/quick-wins/[id]/edit`

**Where**: `src/app/(app)/catalog/quick-wins/[id]/edit/page.tsx`
**Depends on**: T4, T8

**Done when**:
- [ ] Server component; verifica admin; fetch item + vilões em Promise.all
- [ ] `notFound()` se item null
- [ ] Renderiza form em mode='edit'
- [ ] `npm run typecheck` passa

---

### T12: SidebarNav adiciona "Quick Wins" sub-item [P]

**Where**: `src/components/layout/SidebarNav.tsx` (modify)
**Depends on**: none (paralelo)

**Done when**:
- [ ] `Catálogos.children` ganha `{ href: '/catalog/quick-wins', label: 'Quick Wins', icon: Trophy }`
- [ ] Active state funciona em `/catalog/quick-wins`
- [ ] Auto-expand continua quando em qualquer `/catalog*`
- [ ] `npm run typecheck` passa

---

### T13: `QuickWinForm` select + auto-fill

**Where**: `src/components/domain/QuickWinForm.tsx` (modify)
**Depends on**: T4

**Done when**:
- [ ] Nova prop `catalogItems: QuickWinCatalogListItem[]`
- [ ] Em `mode='create'`, novo `<select>` "Tipo do catálogo" no topo com `— sem tipo —` + lista
- [ ] `onChange`:
  - find item; se não found → no-op
  - `setValue('title', item.title)`, `setValue('description', item.description ?? '')`
  - se `item.suggestedVillainId` está em `operationVillains` (find por `villainId`) E `item.defaultImpactPct != null` E `!fields.some(f => f.operation_villain_id === ov.id)` → `append({ operation_villain_id: ov.id, impact_pct: item.defaultImpactPct })`
- [ ] Em `mode='edit'`, select NÃO renderiza
- [ ] `npm run typecheck` passa

---

### T14: Wire em `/operations/[id]/page.tsx` + `QuickWinsSection`

**Where**: `src/app/(app)/operations/[id]/page.tsx` (modify) + `src/components/domain/QuickWinsSection.tsx` (modify)
**Depends on**: T13, T4

**Done when**:
- [ ] page.tsx: `listActiveQuickWinCatalog()` em `Promise.all`
- [ ] page.tsx: passa `catalogItems` pra `QuickWinsSection`
- [ ] `QuickWinsSection` aceita nova prop + repassa pro `QuickWinForm`
- [ ] `npm run typecheck` passa

---

### T15: Smoke E2E

**What**: Validação manual + Supabase MCP.
**Depends on**: T9, T14

**Done when**:
- [ ] SQL confere 21 rows + distribuição 3/vilão
- [ ] Build limpo + zero console error em login page
- [ ] Vercel preview manual (autenticado):
  - /catalog/quick-wins → 21 cards ativos
  - Criar tipo novo → aparece; arquivar → some; restaurar → volta
  - Editar tipo → mudar impact → salva
  - Sidebar "Catálogos" expande, mostra 3 sub-items
  - Op com Manualis atribuído → criar QW → escolher "Automação de relatório recorrente" → título/desc preenchem, impact Manualis +15% aparece
  - Op sem o vilão sugerido → escolher tipo → só preenche título/desc (sem impact)
  - Editar QW existente → select de catálogo NÃO aparece

---

### T16: Atualizar docs

**Where**: `docs/DATABASE_SCHEMA.md` + `.specs/project/STATE.md`
**Depends on**: T15

**Done when**:
- [ ] DATABASE_SCHEMA.md: nova seção `quick_win_catalog`; contagem 23 → 24; migration listada; data atualizada
- [ ] STATE.md: current work atualizado

---

## Parallel Execution Map

```
Phase 1 (seq):
  T1 → T2

Phase 2 (parallel após T2):
  T3 [P], T4 [P], T12 [P]
   └─ T5 (após T3)

Phase 3 (após T5/T4):
  T6, T8 (parallel)
   → T7 (após T6)
   → T9, T10, T11 (parallel após T7/T8)

Phase 4 (após T4):
  T13 → T14

Phase 5 (seq):
  T15 → T16
```

---

## Tools per Task

| Task | MCP | Skill |
|---|---|---|
| T1 | Supabase `apply_migration` | `dryos-conventions` |
| T2 | npm or Supabase `generate_typescript_types` | — |
| T3-T14 | — | `dryos-conventions`, `dryos-design-system` |
| T15 | `Claude_Preview`, Supabase `execute_sql` | — |
| T16 | — | — |
