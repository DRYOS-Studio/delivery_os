# service-products-catalog Tasks

**Design**: `.specs/features/service-products-catalog/design.md`
**Status**: Draft

---

## Execution Plan

```
Phase 1 — Foundation (sequential)
  T1 (migration + seed) → T2 (regen types)

Phase 2 — Backend (parallel após T2)
  ├── T3 helper slugify
  ├── T4 validator
  ├── T5 queries
  └── T6 server actions (depende de T4)

Phase 3 — Catalog UI (sequential após T5/T6)
  ├── T7 ProductCard
  ├── T8 ProductForm (depende de T3)
  ├── T9 page /catalog/products
  ├── T10 page /new
  ├── T11 page /[id]/edit
  └── T12 link no /catalog

Phase 4 — Frente integration (após T5)
  ├── T13 validator frente.product_id
  ├── T14 server action frentes aceita product_id
  └── T15 FrenteForm select + auto-fill (depende de T5)

Phase 5 — Validate + docs (sequential)
  T16 smoke E2E → T17 docs
```

---

## Task Breakdown

### T1: Migration `service_products` + FK em frentes + seed

**What**: Migration SQL criando tabela, constraints, índices, RLS, trigger, FK em frentes, e seed dos 12 produtos. Tudo na mesma migration.
**Where**: `supabase/migrations/<timestamp>_service_products.sql`
**Depends on**: none
**Reuses**: padrão das migrations anteriores (RLS `authenticated_full`, `set_updated_at` trigger, `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`, `DO $$ IF NOT EXISTS pg_constraint`).
**Tools**: Supabase MCP `apply_migration`.

**Done when**:
- [ ] Migration aplicada via MCP `apply_migration`
- [ ] `execute_sql` confirma: tabela existe, 6 constraints, 3 indexes, RLS on, trigger ativo
- [ ] `frentes.product_id` existe com FK `ON DELETE SET NULL`
- [ ] 12 produtos seed presentes (Core, 5 Sparks, 5 Studios, Evergreen)
- [ ] Insert com slug duplicado falha (23505); insert com name 1-char falha; insert com slug "BAD SLUG" falha

---

### T2: Regenerar types

**What**: Rodar `npm run gen:types`.
**Where**: `src/lib/db/types.ts` (regenerado)
**Depends on**: T1
**Tools**: npm script ou Supabase MCP.

**Done when**:
- [ ] `types.ts` tem `service_products` em Tables
- [ ] `frentes.Row` ganha `product_id: string | null`
- [ ] `npm run typecheck` passa

---

### T3: Helper `slugify` [P]

**What**: Função pura `slugify(input)` em novo arquivo.
**Where**: `src/lib/utils/slug.ts` (novo)
**Depends on**: none

**Done when**:
- [ ] `slugify("DRYOS Spark Cobra")` retorna `"dryos-spark-cobra"`
- [ ] `slugify("Studio Bridge+")` retorna `"studio-bridge"`
- [ ] `slugify("  Olá Mundo!  ")` retorna `"ola-mundo"`
- [ ] Remove acentos via NFD normalize
- [ ] Pure function (sem side effects)
- [ ] `npm run typecheck` passa

---

### T4: Validator `serviceProductSchema` [P]

**What**: Zod schema pra create/update.
**Where**: `src/lib/validators/service-product.ts` (novo)
**Depends on**: T2

**Done when**:
- [ ] Schema valida `name` (≥2 trim, ≤80), `slug` (regex), `description` (opt ≤1000), `default_cycle_type` (enum opt aceitando string vazia)
- [ ] `description` e `default_cycle_type` aceitam `""` como undefined
- [ ] Exporta `ServiceProductInput` (input pré-transform) e `ServiceProductOutput` (após transform)
- [ ] `npm run typecheck` passa

---

### T5: Queries `service-products.ts` [P]

**What**: 4 queries server-side.
**Where**: `src/lib/db/queries/service-products.ts` (novo)
**Depends on**: T2

**Done when**:
- [ ] `listServiceProducts()` retorna `ServiceProductRow[]` ordenado `name ASC`
- [ ] `listActiveServiceProducts()` retorna `ServiceProductListItem[]` filtrado `archived_at IS NULL`, ordenado `name ASC`
- [ ] `getServiceProduct(id)` retorna `ServiceProductRow | null`
- [ ] `getServiceProductBySlug(slug)` retorna `ServiceProductRow | null`
- [ ] Todas usam `createServer`
- [ ] `npm run typecheck` passa

---

### T6: Server actions `service-products.ts`

**What**: 4 server actions (create/update/archive/restore).
**Where**: `src/lib/actions/service-products.ts` (novo)
**Depends on**: T4

**Done when**:
- [ ] `createServiceProductAction(formData)`, `updateServiceProductAction(id, formData)`, `archiveServiceProductAction(id)`, `restoreServiceProductAction(id)`
- [ ] Todas começam com `requireAdminAction` (Inv. 14 + admin gating)
- [ ] Zod validation com mapping de issues pra `validation_<field>`
- [ ] DB error mapping: 23505 → `slug_conflict`, 23514 → `check_violation`
- [ ] `revalidatePath('/catalog/products')` em mutações
- [ ] Retorna `ActionResult<{ id: string }>`
- [ ] `npm run typecheck` passa

---

### T7: `ProductCard` component [P após T5]

**What**: Card de produto pro listing.
**Where**: `src/components/domain/ProductCard.tsx` (novo)
**Depends on**: T5
**Reuses**: `Card`, `Pill`, `formatCycleTypeShort`, padrão `VillainCard`.

**Done when**:
- [ ] Props: `{ product: ServiceProductRow; isAdmin: boolean }`
- [ ] Mostra: nome (display), slug (mono), pill de `default_cycle_type` se houver, descrição truncada
- [ ] Se `archived_at`, Card com opacity reduzida + pill "Arquivado"
- [ ] Se `isAdmin`, botões "Editar →" (link) + "Arquivar"/"Restaurar"
- [ ] Server component (botão archive/restore como sub-componente client se precisar de form action)
- [ ] `npm run typecheck` passa

---

### T8: `ProductForm` component [P após T3, T4]

**What**: Form RHF com slug auto-derivado.
**Where**: `src/components/domain/ProductForm.tsx` (novo)
**Depends on**: T3 (slugify), T4 (schema), T6 (action — pode ser placeholder)
**Reuses**: padrão `VillainForm`/`ClientForm`, `Button`, `Field` (inline).

**Done when**:
- [ ] Props discriminated: `{ mode: 'create' }` | `{ mode: 'edit'; initialData: ServiceProductRow }`
- [ ] Campos: name, slug, description (textarea), default_cycle_type (select com `formatCycleTypeLong` + opção "— sem ciclo padrão —")
- [ ] `useEffect` em `watch('name')`: se `!isSlugDirty`, chama `setValue('slug', slugify(name))`
- [ ] `isSlugDirty` vira true quando usuário edita slug manualmente
- [ ] Submit chama action correspondente; OK redirect `/catalog/products` + `router.refresh`
- [ ] Error mapping inline + general
- [ ] `npm run typecheck` passa

---

### T9: Página `/catalog/products`

**What**: Server component que lista produtos.
**Where**: `src/app/(app)/catalog/products/page.tsx` (novo)
**Depends on**: T5, T7
**Reuses**: `getProfile`, `PageHeader`, padrão `/catalog/page.tsx`.

**Done when**:
- [ ] Server component; chama `listServiceProducts()` + `getProfile()`
- [ ] PageHeader "Catálogo · Produtos & Serviços" + botão "+ Adicionar produto" (admin only)
- [ ] Listagem grid: cards ativos primeiro, seção colapsável de arquivados abaixo
- [ ] Vazio (não deveria após seed): empty state amigável
- [ ] Não-admin pode visualizar (sem botões de edit)
- [ ] `npm run typecheck` passa

---

### T10: Página `/catalog/products/new`

**What**: Página de criar produto.
**Where**: `src/app/(app)/catalog/products/new/page.tsx` (novo)
**Depends on**: T8

**Done when**:
- [ ] Server component; verifica `isAdmin` via `getProfile`; redirect/notFound se não
- [ ] Renderiza `<ProductForm mode="create" />`
- [ ] `npm run typecheck` passa

---

### T11: Página `/catalog/products/[id]/edit`

**What**: Página de editar produto.
**Where**: `src/app/(app)/catalog/products/[id]/edit/page.tsx` (novo)
**Depends on**: T5, T8

**Done when**:
- [ ] Server component; verifica admin; fetch `getServiceProduct(id)`
- [ ] Se não encontrado, `notFound()`
- [ ] Renderiza `<ProductForm mode="edit" initialData={product} />`
- [ ] `npm run typecheck` passa

---

### T12: Link em `/catalog`

**What**: Adicionar link discreto no header de `/catalog/page.tsx` apontando pra produtos.
**Where**: `src/app/(app)/catalog/page.tsx` (modify)
**Depends on**: none (paralelo)

**Done when**:
- [ ] PageHeader ganha link/botão "Ver produtos →" próximo do título
- [ ] Recíproco em `/catalog/products/page.tsx`: link "← Voltar pra Vilões" ou similar
- [ ] `npm run typecheck` passa

---

### T13: Validator de Frente aceita `product_id` [P]

**What**: Adicionar campo opcional `product_id` ao schema de Frente existente.
**Where**: `src/lib/validators/frente.ts` (modify)
**Depends on**: T2

**Done when**:
- [ ] Field `product_id: z.string().uuid().optional().or(z.literal('').transform(() => undefined))`
- [ ] Não quebra Frentes existentes (campo opcional)
- [ ] `npm run typecheck` passa

---

### T14: Server actions de Frente persistem `product_id` [P]

**What**: `parseFormData` lê `product_id`; INSERT/UPDATE inclui.
**Where**: `src/lib/actions/frentes.ts` (modify)
**Depends on**: T13

**Done when**:
- [ ] `parseFormData` lê `product_id`
- [ ] `createFrenteAction` insere `product_id ?? null`
- [ ] `updateFrenteAction` updateia `product_id ?? null`
- [ ] Mapping `23503` (FK violation) → `err('Produto inválido.', 'invalid_product')`
- [ ] `npm run typecheck` passa

---

### T15: `FrenteForm` ganha select de Produto + auto-fill

**What**: Adicionar select de Produto antes de cycle_type, com `useEffect` pra auto-preencher.
**Where**: `src/components/domain/FrenteForm.tsx` (modify)
**Depends on**: T5, T13, T14

**Done when**:
- [ ] Nova prop `products: ServiceProductListItem[]`
- [ ] Default value: `product_id = initialData?.product_id ?? ''`
- [ ] Novo `<select>` antes de "Tipo de ciclo" com `<option value="">— sem produto —</option>` + lista de ativos
- [ ] `useEffect` em `watch('product_id')`:
  - useRef `isInitialMount` que volta false após primeiro render
  - se `!isInitialMount` e produto novo tem `default_cycle_type`, `setValue('cycle_type', defaultCycleType)`
- [ ] Submit envia `product_id` no FormData
- [ ] Callers (`new` e `edit` pages) passam `products` via `listActiveServiceProducts()`
- [ ] `npm run typecheck` passa

---

### T16: Smoke E2E

**What**: Validação manual via preview + Supabase MCP.
**Depends on**: T9, T15

**Done when**:
- [ ] Logado admin → /catalog/products → ver 12 produtos
- [ ] Criar produto "Custom Test" → aparece na lista
- [ ] Editar "Custom Test" → mudar default_cycle_type pra C → salva
- [ ] Arquivar → vai pra seção arquivados
- [ ] Restaurar → volta
- [ ] Abrir form de nova Frente → escolher "Spark Inbox" → cycle_type vira C automaticamente
- [ ] Mudar produto pra "Studio Custom" → cycle_type vira A
- [ ] Salvar Frente → product_id persistido no banco
- [ ] Tabs Frentes/Reuniões/Anexos/SLA do `/public/[token]` continuam funcionando
- [ ] Zero erro de console

---

### T17: Atualizar docs

**What**: `docs/DATABASE_SCHEMA.md` + `.specs/project/STATE.md`.
**Depends on**: T16

**Done when**:
- [ ] DATABASE_SCHEMA.md adiciona seção `service_products`; contagem 22 → 23; coluna `product_id` documentada em frentes; migration listada; data atualizada
- [ ] STATE.md: current work atualizado, eventual AD se houver decisão notável

---

## Parallel Execution Map

```
Phase 1 (seq):
  T1 → T2

Phase 2 (parallel após T2):
  T3 [P], T4 [P], T5 [P], T13 [P]
   └─ T6 (após T4)
   └─ T14 (após T13)

Phase 3 (sequential):
  T7, T8 (paralelos após T5/T3/T4)
   → T9, T10, T11 (paralelos após T7/T8)
   → T12 (qualquer hora)

Phase 4:
  T15 (após T5, T13, T14)

Phase 5 (seq):
  T16 → T17
```

---

## Tools per Task

| Task | MCP | Skill |
|---|---|---|
| T1 | Supabase `apply_migration` | `dryos-conventions` |
| T2 | Supabase `generate_typescript_types` ou npm | — |
| T3-T15 | — | `dryos-conventions`, `dryos-design-system` (UI) |
| T16 | `Claude_Preview`, Supabase `execute_sql` | — |
| T17 | — | — |
