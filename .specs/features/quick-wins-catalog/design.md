# quick-wins-catalog Design

**Spec**: `.specs/features/quick-wins-catalog/spec.md`
**Status**: Draft

---

## Architecture Overview

Mesma estrutura do `service-products-catalog` recém-mergeado: tabela isolada com archive-only, CRUD admin numa rota dedicada, integração opcional em form existente. Plus item novo na sidebar.

```
Internal: /catalog (sidebar parent "Catálogos")
   ├─ /villains (existe)
   ├─ /products (existe — entregue em #66)
   └─ /quick-wins (novo)
         ├─ QuickWinCatalogList (server)
         ├─ QuickWinCatalogCard (server)
         ├─ /new → QuickWinCatalogForm
         └─ /[id]/edit → QuickWinCatalogForm (pré-preenchido)

Form de QW em Operação:
   QuickWinForm (mode='create')
     └─ NEW: <select> "Tipo do catálogo"
          └─ onChange: setValue título + descrição + append impact (se vilão sugerido está na Op)
```

---

## Code Reuse Analysis

### Existing patterns to leverage

| Component / Module | Location | How to use |
|---|---|---|
| `ProductCard` + `ProductForm` | `src/components/domain/Product*.tsx` (entregue em #66) | Modelo direto pra `QuickWinCatalogCard` + `QuickWinCatalogForm` — mesma forma de archive button + admin gating + slug auto-derive (este sem slug, mais simples) |
| `service-products.ts` actions | `src/lib/actions/service-products.ts` | Padrão de CRUD + archive/restore com `requireAdminAction` + DB error mapping (23505/23503) |
| `ArchiveServiceProductButton` | `src/components/domain/ArchiveServiceProductButton.tsx` | Copy pra `ArchiveQuickWinCatalogButton` (mesma estrutura, só troca o action) |
| `SidebarNav` (já parametrizado com `NavParent.children`) | `src/components/layout/SidebarNav.tsx` (#73) | Adicionar entrada `quick-wins` no array `children` de "Catálogos" — uma linha |
| `requireAdminAction` / `getProfile` | `src/lib/auth/server.ts` | Guard server-side |
| `Pill`, `Card`, `Button`, `PageHeader` | `src/components/ui/*` | Atomos UI |
| `resolveVillainIcon` | `src/lib/constants/villain-icons.ts` | Renderizar ícone do vilão sugerido no card |
| `ActionResult`, `ok`, `err`, `dbErr` | `src/lib/actions/_types.ts` | Padrão de retorno |

### Integration points

| System | Integration method |
|---|---|
| `villains` table | FK `suggested_villain_id` ON DELETE SET NULL (não bloqueia archive de vilão; só zera sugestão) |
| `QuickWinForm` (form de criar QW em Operação) | Nova prop `catalogItems`; novo `<select>` no topo; `onChange` faz `setValue` + condicional `append` em `useFieldArray` |
| `/operations/[id]/page.tsx` | Fetch `listActiveQuickWinCatalog()` + passa pro `QuickWinsSection` que repassa pro `QuickWinForm` |
| Sidebar | Uma linha em `SidebarNav.tsx` |

---

## Components

### `QuickWinCatalogCard` (server component)

- **Purpose**: Renderiza um tipo do catálogo no listing
- **Location**: `src/components/domain/QuickWinCatalogCard.tsx`
- **Interfaces**: `{ item: QuickWinCatalogRow; suggestedVillain?: VillainBrief | null; isAdmin: boolean }`
- **Reuses**: `Card`, `Pill`, `resolveVillainIcon`, padrão `ProductCard`

### `QuickWinCatalogForm` (client component)

- **Purpose**: Form de create/edit
- **Location**: `src/components/domain/QuickWinCatalogForm.tsx`
- **Interfaces**: discriminated `{ mode: 'create'; villains: VillainBrief[] }` | `{ mode: 'edit'; initialData: QuickWinCatalogRow; villains: VillainBrief[] }`
- **Reuses**: RHF + zodResolver, padrão `ProductForm`. Sem slug.

### `ArchiveQuickWinCatalogButton` (client)

- **Purpose**: Botão archive/restore
- **Location**: `src/components/domain/ArchiveQuickWinCatalogButton.tsx`
- **Reuses**: Cópia direta de `ArchiveServiceProductButton`

### `QuickWinCatalogListPage` (server)

- **Location**: `src/app/(app)/catalog/quick-wins/page.tsx`
- **Reuses**: padrão `/catalog/products/page.tsx`

### `/catalog/quick-wins/new` e `/[id]/edit` (server)

- **Locations**: `src/app/(app)/catalog/quick-wins/new/page.tsx` + `src/app/(app)/catalog/quick-wins/[id]/edit/page.tsx`
- **Body**: guard admin + fetch vilões ativos + render form

### Modificações em `QuickWinForm`

- Nova prop `catalogItems: QuickWinCatalogListItem[]`
- Em `mode='create'`, renderiza `<select>` "Tipo do catálogo" no topo:
  - `<option value="">— sem tipo —</option>`
  - Lista ativos ordenados por título
- `onChange` (handler):
  - se vazio → no-op
  - encontra `catalogItem` por id
  - `setValue('title', catalogItem.title)`
  - `setValue('description', catalogItem.description ?? '')`
  - se `catalogItem.suggestedVillainId` está em `operationVillains` (find por `villainId`) E `catalogItem.defaultImpactPct != null`:
    - check se já existe `impacts` com esse `operation_villain_id` (`fields.some(...)`)
    - se não, `append({ operation_villain_id: ov.id, impact_pct: catalogItem.defaultImpactPct })`
- Em `mode='edit'`, **não** renderizar o select (decisão da spec)

### Modificações em `QuickWinsSection`

- Aceitar nova prop `catalogItems: QuickWinCatalogListItem[]`
- Repassar pro `QuickWinForm`

### Modificações em `/operations/[id]/page.tsx`

- Adicionar `listActiveQuickWinCatalog()` no `Promise.all`
- Passar `catalogItems` pra `QuickWinsSection`

### Modificações em `SidebarNav.tsx`

- No `adminGroup.items` → entrada Catálogos → `children`:
  ```ts
  { href: "/catalog/quick-wins", label: "Quick Wins", icon: Trophy }
  ```

---

## Data Models

### `quick_win_catalog` (nova tabela)

```sql
CREATE TABLE public.quick_win_catalog (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 text NOT NULL,
  description           text,
  suggested_villain_id  uuid,
  default_impact_pct    smallint,
  archived_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_qwc_villain FOREIGN KEY (suggested_villain_id)
    REFERENCES public.villains(id) ON DELETE SET NULL
);

ALTER TABLE public.quick_win_catalog
  ADD CONSTRAINT chk_qwc_title_min CHECK (length(trim(title)) BETWEEN 3 AND 120);

ALTER TABLE public.quick_win_catalog
  ADD CONSTRAINT chk_qwc_impact_range
  CHECK (default_impact_pct IS NULL OR (default_impact_pct >= 1 AND default_impact_pct <= 100));

-- UNIQUE case-insensitive por título (evita duplicatas tipo "Auto X" vs "auto x")
CREATE UNIQUE INDEX idx_qwc_title_unique_ci
  ON public.quick_win_catalog (lower(trim(title)));

CREATE INDEX idx_qwc_archived_active
  ON public.quick_win_catalog (title) WHERE archived_at IS NULL;

ALTER TABLE public.quick_win_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY qwc_authenticated_full
  ON public.quick_win_catalog FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_qwc_updated_at
  BEFORE UPDATE ON public.quick_win_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.quick_win_catalog IS
  'catalog: tipos pré-definidos de Quick Win com vilão sugerido e impacto sugerido. Admin gerencia em /catalog/quick-wins; form de QW em Operação usa pra auto-fill (não persiste origem). Archive-only via archived_at.';
```

### Seed (21 entradas)

Insere via subquery pra resolver `villains.id` pelos slugs (não hardcode UUIDs).

```sql
WITH v AS (SELECT id, slug FROM public.villains)
INSERT INTO public.quick_win_catalog
  (title, description, suggested_villain_id, default_impact_pct) VALUES
  -- Manualis
  ('Automação de relatório recorrente', 'Substituir geração manual de relatório por job programado com snapshot versionado.', (SELECT id FROM v WHERE slug='manualis'), 15),
  ('Eliminação de cópia manual entre sistemas', 'Pipeline (webhook ou ETL) replaceia copy-paste entre planilha/CRM.', (SELECT id FROM v WHERE slug='manualis'), 12),
  ('Templates padronizados de comunicação', 'Library de mensagens pré-aprovadas reduz redação manual em casos repetidos.', (SELECT id FROM v WHERE slug='manualis'), 8),
  -- Silos
  ('Integração entre sistemas via API/webhook', 'Conectar dois sistemas que antes só conversavam via export manual.', (SELECT id FROM v WHERE slug='silos'), 15),
  ('Base unificada de leads/contas', 'Dedup + merge cria fonte única; deixa de ter "qual sistema tem o dado certo?"', (SELECT id FROM v WHERE slug='silos'), 12),
  ('Single source of truth definido', 'Documentar e enforçar qual sistema é canônico pra cada entidade.', (SELECT id FROM v WHERE slug='silos'), 10),
  -- Retrabalho
  ('Checklist de qualidade pré-entrega', 'Lista padronizada de verificação reduz devoluções pós-entrega.', (SELECT id FROM v WHERE slug='retrabalho'), 10),
  ('Revisão estruturada com cliente', 'Reunião curta de validação com prompts específicos antes do entregável final.', (SELECT id FROM v WHERE slug='retrabalho'), 12),
  ('Versionamento de assets/documentos', 'Branch/PR pra docs evita perda de mudanças e conflito de versão.', (SELECT id FROM v WHERE slug='retrabalho'), 8),
  -- Lento
  ('Reunião semanal de desbloqueio', 'Touchpoint curto remove impedimentos antes que viram bottleneck.', (SELECT id FROM v WHERE slug='lento'), 8),
  ('SLA acionável definido por etapa', 'Tempo máximo por fase com responsável e alerta automático.', (SELECT id FROM v WHERE slug='lento'), 10),
  ('Caminho crítico mapeado', 'Identificar e medir só as dependências que bloqueiam o resto do fluxo.', (SELECT id FROM v WHERE slug='lento'), 8),
  -- Achismo
  ('Dashboard executivo entregue', 'KPIs principais em 1 tela atualizada em tempo real.', (SELECT id FROM v WHERE slug='achismo'), 15),
  ('Forecast quantitativo de receita', 'Modelo (mesmo simples) de projeção substitui chute do gestor.', (SELECT id FROM v WHERE slug='achismo'), 12),
  ('A/B test estruturado', 'Validar mudança com hipótese, métrica e amostra antes de roll-out.', (SELECT id FROM v WHERE slug='achismo'), 10),
  -- Drenador
  ('Análise de custo por entrega', 'Custo unitário expõe margens negativas escondidas em médias.', (SELECT id FROM v WHERE slug='drenador'), 10),
  ('Substituição de SaaS redundante', 'Cancelar/consolidar ferramenta que duplicava função de outra.', (SELECT id FROM v WHERE slug='drenador'), 8),
  ('Renegociação de fornecedor crítico', 'Re-tier ou volume discount cortando custo fixo recorrente.', (SELECT id FROM v WHERE slug='drenador'), 8),
  -- Enganador
  ('North star metric definida', 'Métrica única que alinha o time e expõe vaidade de outras.', (SELECT id FROM v WHERE slug='enganador'), 12),
  ('Funil de retenção mapeado', 'Cohort por safra revela churn real escondido em "MRR cresceu".', (SELECT id FROM v WHERE slug='enganador'), 10),
  ('Coorte de receita por safra', 'Receita por mês de aquisição revela payback period e LTV verdadeiros.', (SELECT id FROM v WHERE slug='enganador'), 10);
```

---

## New Queries

### `src/lib/db/queries/quick-win-catalog.ts`

| Function | Returns |
|---|---|
| `listQuickWinCatalog()` | `QuickWinCatalogRow[]` (todos) ordenado por `title ASC` |
| `listActiveQuickWinCatalog()` | `QuickWinCatalogListItem[]` (ativos com join `suggested_villain`) ordenado por `title ASC` |
| `getQuickWinCatalogItem(id)` | `QuickWinCatalogRow | null` |

Types:
```ts
export type QuickWinCatalogRow = Database['public']['Tables']['quick_win_catalog']['Row'];

type SuggestedVillain = { id: string; name: string; slug: string; iconName: string; pillVariant: string; archivedAt: string | null };

export type QuickWinCatalogListItem = {
  id: string;
  title: string;
  description: string | null;
  defaultImpactPct: number | null;
  suggestedVillainId: string | null;
  suggestedVillain: SuggestedVillain | null;
};
```

---

## Server Actions

### `src/lib/actions/quick-win-catalog.ts`

| Action | Signature |
|---|---|
| `createQuickWinCatalogAction(formData)` | `Promise<ActionResult<{ id }>>` |
| `updateQuickWinCatalogAction(id, formData)` | `Promise<ActionResult<{ id }>>` |
| `archiveQuickWinCatalogAction(id)` | `Promise<ActionResult<{ id }>>` |
| `restoreQuickWinCatalogAction(id)` | `Promise<ActionResult<{ id }>>` |

Pattern: `requireAdminAction` first; zod via `validate`; DB error mapping (23505 → title_conflict, 23503 → validation_suggested_villain_id, 23514 → check_violation); `revalidatePath('/catalog/quick-wins')`.

---

## Validators

### `src/lib/validators/quick-win-catalog.ts`

```ts
export const quickWinCatalogSchema = z.object({
  title: z.string().transform(s => s.trim()).pipe(z.string().min(3).max(120)),
  description: z.string().transform(s => s.trim()).pipe(z.string().max(2000))
    .optional().or(z.literal('').transform(() => undefined)),
  suggested_villain_id: z.string().uuid().optional()
    .or(z.literal('').transform(() => undefined)),
  default_impact_pct: z.coerce.number().int().min(1).max(100)
    .optional().or(z.literal('').transform(() => undefined)),
});
```

---

## Error Handling

| Scenario | Handling | User impact |
|---|---|---|
| Título duplicado (case-insensitive) | DB 23505 → `title_conflict` | Erro no campo title |
| Vilão FK inválido | DB 23503 → `validation_suggested_villain_id` | Erro no select de vilão |
| Impact pct fora de range | Zod fail → `validation_default_impact_pct` | Erro no campo |
| Vilão arquivado mas tipo sugere ele | Tipo continua válido; pill no admin card mostra "(arquivado)" no nome | Sem efeito funcional |
| Auto-fill tenta adicionar impact pra vilão não atribuído à Op | Silent skip — só `setValue` título/descrição | Usuário adiciona impact manual se quiser |

---

## Tech Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Sem coluna `from_catalog_id` no QW criado | Decisão deliberada | Auto-fill é conveniência; QW depois é independente. Rastreabilidade fica P2. |
| Vilão sugerido único (não M:N) | FK simples | MVP suficiente. Tabela `catalog_villain_weights` overkill agora. |
| UNIQUE case-insensitive em title | `UNIQUE INDEX (lower(trim(title)))` | Evita duplicatas tipo "Automação X" vs "automação x" sem CHECK complicado. |
| Sem slug | Catálogo é interno; URL `/catalog/quick-wins/[uuid]/edit` | Slug seria peso extra sem ganho — não há link público pra esse catálogo. |
| Seed via WITH+subquery por slug | Não hardcoda UUIDs | Migration idempotente entre projetos Supabase futuros. |
| ON DELETE SET NULL na FK villain | Não bloqueia archive/delete de vilão | Tipos seguem funcionando; perdem só a sugestão. |
| Select de catálogo no QuickWinForm só em `mode='create'` | Evita re-aplicar defaults sobre QW existente em edit | Decisão da spec. |
| Auto-fill sobrescreve título/descrição | `setValue` direto, sem confirmação | Form ainda em criação; previsível. Usuário pode editar depois. |
