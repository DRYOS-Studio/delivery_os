# service-products-catalog Design

**Spec**: `.specs/features/service-products-catalog/spec.md`
**Status**: Draft

---

## Architecture Overview

Espelha o padrão existente do catálogo de Vilões (`/catalog/villains`) com algumas adaptações:
- Tabela isolada, RLS + admin gating padrão
- Server Actions com `ActionResult<T>`
- FK opcional em `frentes.product_id` com `ON DELETE SET NULL`
- Form com slug auto-derivado client-side via watch + setValue (RHF)

```
Internal: /catalog
   ├─ /villains (existe)
   └─ /products (novo)
         ├─ ProductsList (server component)
         ├─ ProductCard (client/server — toggle expand)
         ├─ /new → ProductForm (client)
         └─ /[id]/edit → ProductForm pré-preenchido

Frente form:
   FrenteForm
     ├─ <select> Produto/Serviço (novo, top)
     │    └─ onChange dispara setValue('cycle_type', ...)
     └─ <select> Tipo de ciclo (existe, agora pode ser auto-preenchido)
```

---

## Code Reuse Analysis

### Existing patterns to leverage

| Component / Module | Location | How to use |
|---|---|---|
| `VillainCard` + `VillainForm` | `src/components/domain/Villain*.tsx` | Modelo direto pro `ProductCard` + `ProductForm` (mesma estrutura: card admin-editável + form com archive/restore) |
| `villains.ts` actions | `src/lib/actions/villains.ts` | Padrão de archive/restore/CRUD com `requireAdminAction` |
| `clients.ts` actions | `src/lib/actions/clients.ts` | Padrão de slug auto-derivado e conflict mapping (23505) |
| `formatCycleTypeShort/Long` | `src/lib/utils/cycle-type.ts` | Reaproveitar pra exibir/labelar `default_cycle_type` |
| `requireAdminAction` / `getProfile` | `src/lib/auth/server.ts` | Guard server-side |
| `PageHeader` | `src/components/layout/PageHeader.tsx` | Header da página de catálogo |
| `Card`, `Pill`, `Button`, `Field` | `src/components/ui/*` | Atomos UI |
| `ActionResult`, `ok`, `err`, `dbErr` | `src/lib/actions/_types.ts` | Padrão de retorno |

### Integration points

| System | Integration method |
|---|---|
| `frentes` | Nova coluna `product_id` nullable FK; preserva Frentes existentes (default NULL) |
| `FrenteForm` | Recebe nova prop `products: ServiceProductListItem[]`; novo `<select>` antes do cycle_type; `useEffect` em `watchedProductId` dispara `setValue('cycle_type', ...)` |
| `frentes` server actions | Aceitar `product_id` no `parseFormData` e setar no INSERT/UPDATE (nullable) |
| `/catalog` page | Adicionar link discreto pra `/catalog/products` no header |

---

## Components

### `ProductCard` (server component)

- **Purpose**: Renderiza um card de produto no `/catalog/products` (nome, slug, ciclo, descrição) com botões admin
- **Location**: `src/components/domain/ProductCard.tsx`
- **Interfaces**:
  - Props: `{ product: ServiceProductRow; isAdmin: boolean }`
- **Reuses**: `Card`, `Pill`, `formatCycleTypeShort`, `Link`

### `ProductForm` (client component)

- **Purpose**: Form de criar/editar produto com slug auto-derivado
- **Location**: `src/components/domain/ProductForm.tsx`
- **Interfaces**:
  - Props discriminated union:
    - `{ mode: 'create' }`
    - `{ mode: 'edit'; initialData: ServiceProductRow }`
- **Reuses**: `react-hook-form` + `zodResolver`, padrão de `VillainForm`/`ClientForm`
- **Particular**: `useEffect` em `watchedName` chama `setValue('slug', slugify(name))` desde que usuário não tenha tocado em slug (`isSlugDirty` state)

### `ProductsListPage` (server component)

- **Purpose**: Página `/catalog/products` — server-renders lista de ativos + arquivados
- **Location**: `src/app/(app)/catalog/products/page.tsx`
- **Reuses**: `getProfile`, `listServiceProducts`, `PageHeader`

### `/catalog/products/new` (server component)

- **Location**: `src/app/(app)/catalog/products/new/page.tsx`
- **Body**: guard admin + render `ProductForm mode="create"`

### `/catalog/products/[id]/edit` (server component)

- **Location**: `src/app/(app)/catalog/products/[id]/edit/page.tsx`
- **Body**: guard admin + fetch `getServiceProduct(id)` + render `ProductForm mode="edit"`

### Modificações em `FrenteForm`

- Recebe nova prop `products: ServiceProductListItem[]`
- Default value: se edit, `product_id = initialData.product_id ?? ''`
- Add `<select>` "Produto/Serviço" antes do "Tipo de ciclo"
- `useEffect` em `watch('product_id')`: se mudou e produto novo tem `default_cycle_type`, chama `setValue('cycle_type', product.default_cycle_type)`. Skip no primeiro render (edit pré-carregado).

---

## Data Models

### `service_products` (nova tabela)

```sql
CREATE TABLE public.service_products (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  slug                text NOT NULL,
  description         text,
  default_cycle_type  public.frente_cycle_type,
  archived_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_products
  ADD CONSTRAINT chk_service_products_name_min CHECK (length(trim(name)) >= 2);

ALTER TABLE public.service_products
  ADD CONSTRAINT chk_service_products_slug_format
  CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$');

CREATE UNIQUE INDEX idx_service_products_slug ON public.service_products(slug);
CREATE INDEX idx_service_products_archived_active
  ON public.service_products (name) WHERE archived_at IS NULL;

ALTER TABLE public.service_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_products_authenticated_full
  ON public.service_products FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_service_products_updated_at
  BEFORE UPDATE ON public.service_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.service_products IS
  'catalog: produtos comerciais DRYOS (Core, Sparks, Studios, Evergreen). Referenciado opcionalmente por frentes via product_id. Archive-only, nunca delete real.';
```

### FK em `frentes`

```sql
ALTER TABLE public.frentes
  ADD COLUMN IF NOT EXISTS product_id uuid;

ALTER TABLE public.frentes
  ADD CONSTRAINT fk_frentes_product_id FOREIGN KEY (product_id)
  REFERENCES public.service_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_frentes_product_id
  ON public.frentes(product_id) WHERE product_id IS NOT NULL;

COMMENT ON COLUMN public.frentes.product_id IS
  'Produto comercial DRYOS associado a esta Frente. Opcional (Frentes pré-catálogo ficam null). FK SET NULL preserva Frente se produto for deletado.';
```

### Seed (12 produtos)

```sql
INSERT INTO public.service_products (name, slug, default_cycle_type, description) VALUES
  ('DRYOS Core', 'core', 'c', 'Plataforma premium com 8 módulos integrados (CRM, Deals, Inbox, Reach, Flow, Insights, Guard, Aegis). Operação contínua recorrente.'),
  ('Spark Inbox', 'spark-inbox', 'c', 'Atendimento com IA na caixa de entrada. Sprint recorrente mensal.'),
  ('Spark Bridge', 'spark-bridge', 'c', 'Integrações sob medida entre sistemas. Sprint recorrente mensal.'),
  ('Spark Specialist', 'spark-specialist', 'c', 'Agente IA especializado em domínio. Sprint recorrente mensal.'),
  ('Spark Pulse', 'spark-pulse', 'c', 'Dashboards e indicadores operacionais. Sprint recorrente mensal.'),
  ('Spark Cobra', 'spark-cobra', 'c', 'Cobrança automatizada. Sprint recorrente mensal.'),
  ('Studio Launch', 'studio-launch', 'd', 'Infra técnica completa para lançamentos digitais. Edições episódicas.'),
  ('Studio Custom', 'studio-custom', 'a', 'Sistemas internos sob medida. Projeto finito.'),
  ('Studio Insight', 'studio-insight', 'a', 'Plataformas de inteligência customizadas. Projeto finito.'),
  ('Studio Bridge+', 'studio-bridge-plus', 'a', 'Integrações complexas com legacy. Projeto finito.'),
  ('Studio Agent', 'studio-agent', 'a', 'Agentes IA com requisitos únicos. Projeto finito.'),
  ('Evergreen', 'evergreen', 'e', 'Manutenção continuada de plataformas entregues. Tipo E.');
```

---

## New Queries

### `src/lib/db/queries/service-products.ts`

| Function | Returns |
|---|---|
| `listServiceProducts()` | `ServiceProductRow[]` — todos, ordenados por `name ASC` |
| `listActiveServiceProducts()` | `ServiceProductListItem[]` — só `archived_at IS NULL`, shape mínima pra forms |
| `getServiceProduct(id)` | `ServiceProductRow \| null` |
| `getServiceProductBySlug(slug)` | `ServiceProductRow \| null` |

Types:
```ts
export type ServiceProductRow = Database['public']['Tables']['service_products']['Row'];

export type ServiceProductListItem = {
  id: string;
  name: string;
  slug: string;
  defaultCycleType: CycleType | null;
};
```

---

## Server Actions

### `src/lib/actions/service-products.ts`

| Action | Signature |
|---|---|
| `createServiceProductAction(formData)` | `Promise<ActionResult<{ id: string }>>` |
| `updateServiceProductAction(id, formData)` | `Promise<ActionResult<{ id: string }>>` |
| `archiveServiceProductAction(id)` | `Promise<ActionResult<{ id: string }>>` |
| `restoreServiceProductAction(id)` | `Promise<ActionResult<{ id: string }>>` |

**Common pattern:**
- `requireAdminAction()` primeiro (mutação admin-only)
- Zod schema valida `{ name (≥2 trim), slug (regex), description (opt, ≤1000), default_cycle_type (enum opt) }`
- Mapeia 23505 → `err('Slug já em uso.', 'slug_conflict')`
- Mapeia 23514 → `err('Valores fora do permitido.', 'check_violation')`
- `revalidatePath('/catalog/products')` + `revalidatePath('/catalog/products/[id]/edit', 'page')`

### Modificações em `frentes.ts` actions

- `parseFormData` lê `product_id`
- Validator aceita `product_id` opcional uuid (ou string vazia → null)
- INSERT/UPDATE inclui `product_id: data.product_id ?? null`

---

## Validators

### `src/lib/validators/service-product.ts`

```ts
export const serviceProductSchema = z.object({
  name: z.string().transform(s => s.trim()).pipe(z.string().min(2).max(80)),
  slug: z.string()
    .transform(s => s.trim().toLowerCase())
    .pipe(z.string().regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'Slug inválido (use minúsculas, dígitos e hífens).')),
  description: z.string().transform(s => s.trim()).pipe(z.string().max(1000)).optional().or(z.literal('').transform(() => undefined)),
  default_cycle_type: z.enum(['a','b','c','d','e']).optional().or(z.literal('').transform(() => undefined)),
});
```

### Modificação em `validators/frente.ts`

Adicionar `product_id: z.string().uuid().optional().or(z.literal('').transform(() => undefined))` ao schema existente.

---

## Helpers

### `src/lib/utils/slug.ts` (novo)

```ts
export function slugify(input: string): string;
// "DRYOS Spark Cobra" → "dryos-spark-cobra"
// "Studio Bridge+" → "studio-bridge"  (sinais não-alfanuméricos viram hífen, colapsando múltiplos)
```

Implementação: lowercase, normalize NFD (remove acentos), replace `[^a-z0-9]+` por `-`, trim `-`.

---

## Error Handling Strategy

| Scenario | Handling | User impact |
|---|---|---|
| Slug duplicado | `err('Slug já em uso.', 'slug_conflict')` | Form mostra erro no campo slug |
| Name < 2 chars trim | Zod fail → `validation_name` | Erro no campo nome |
| Slug não-regex | Zod fail → `validation_slug` | Erro no campo slug |
| Default cycle type inválido | Zod fail → `validation_default_cycle_type` | Erro no campo |
| Não-admin invoca action | `requireAdminAction` retorna `err('...', 'forbidden')` | Botões admin não devem aparecer pra não-admin, mas defense in depth |
| Produto arquivado mas Frente referencia | Frente continua válida; FK ON DELETE SET NULL apenas em delete real (nunca acontece via UI) | Sem efeito visível |

---

## Tech Decisions

| Decision | Choice | Rationale |
|---|---|---|
| FK behavior em `frentes.product_id` | `ON DELETE SET NULL` | Archive é o padrão DRYOS — mas se algum dia produto for hard-deleted (defesa), Frentes não vão pra órfão. |
| Slug auto-derive | Client-side via `useEffect` + dirty flag | UX melhor que o usuário ter que pensar em slug. Mas se editar manualmente, respeita. |
| Onde adicionar link `/catalog/products` | Header simples em `/catalog/page.tsx` + breadcrumb na página de produtos | Tabs seria refactor maior do catalog. Pode evoluir depois. |
| Seed onde | Mesma migration | Atomicidade; sem `supabase/seed/dev_demo.sql` pra produção. |
| Field de produto no FrenteForm | Acima do cycle_type | Fluxo natural: usuário escolhe O QUE entrega antes do COMO. |
| Auto-fill cycle_type | Em toda mudança do select de produto (não só primeira) | Previsível. Se usuário quer override, faz na hora — não bloqueia. |
| Skip auto-fill em edit pré-carregado | `useRef` flag `isInitialLoad` | Não sobrescrever cycle_type que já está salvo no DB. |
| Listagem ordenação | Alfabética por name (ativos primeiro) | Sem `display_order` por enquanto. Adicionar depois se incomodar. |
| Produto no público (`/public/[token]`) | Não exposto neste PR | Vamos decidir quando virmos o impacto. |
