# home-and-ui-foundation Design

**Spec**: `.specs/features/home-and-ui-foundation/spec.md`
**Status**: Draft

---

## Architecture Overview

Layout pelo route group `(app)`: layout adiciona Sidebar; cada página renderiza `<PageHeader />` + conteúdo. Home (`/`) é Server Component que faz UMA query Supabase com embed de relações, mapeia pra `OperationCard[]`, e renderiza no grid. Components primitivos vão em `src/components/ui/`, layout em `layout/`, domain em `domain/` (skill `dryos-conventions`).

```mermaid
graph TD
    Layout[app/(app)/layout.tsx<br/>Sidebar + main] --> Home[app/(app)/page.tsx<br/>Home Server Component]
    Home --> Query[lib/db/queries/operations.ts<br/>getActiveOperations]
    Query --> Supabase[(Supabase)]
    Home --> PageHeader[components/layout/PageHeader]
    Home --> Tabs[Tabs estáticas<br/>inline na Home]
    Home --> Grid[OperationCard grid]
    Grid --> OperationCard[components/domain/OperationCard]
    OperationCard --> Pill[components/ui/Pill]
    OperationCard --> Card[components/ui/Card]
    Layout --> Sidebar[components/layout/Sidebar]
    Sidebar --> SidebarNav[components/layout/SidebarNav<br/>'use client' pra usePathname]
    Sidebar --> SignOutForm[form action=signOutAction]
```

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component / Pattern | Location | How to Use |
|---|---|---|
| Tokens DS v2 (cores, fontes, radius) | `src/styles/globals.css` | Tudo via classes Tailwind (`bg-card`, `font-display`, `rounded-pill`, etc) |
| `Pill` snippet | `.claude/skills/dryos-design-system/SKILL.md` (seção "Pill") | Copiar verbatim — 6 variants, `showDot` opcional |
| `Card` snippet | skill `dryos-design-system` (seção "Card") | Copiar verbatim — radius 10px, shadow-sm, interactive |
| `Button` snippet (estrutura) | skill `dryos-design-system` (seção "Botão") | Adaptar — skill mostra variants e sizes mas não é componente completo; eu fecho os tipos |
| `createServer()` | `src/lib/db/client.ts` | Server Component da Home chama pra obter cliente tipado |
| `Database` types | `src/lib/db/types.ts` | Tipos das tabelas + enums |
| `cn` helper | A criar em `src/lib/utils/cn.ts` (snippet do skill referenciava `@/lib/utils`) | Esta feature **cria** o helper (`clsx + tailwind-merge`); necessário pra `Pill`/`Card`/`Button` mesclarem className. |
| `getUser` / `requireUser` | `src/lib/auth/server.ts` | Sidebar usa `getUser` pra mostrar e-mail no footer |
| `signOutAction` | `src/lib/actions/auth.ts` | Sidebar footer faz `<form action={signOutAction}>` |
| Lucide React | `npm install lucide-react` (não instalada ainda — install nessa feature) | Ícones: `LogOut`, `Home` (sidebar), `Settings` (catálogo), `LayoutDashboard` (painel) — stroke-1.75 visual ajustado em prop ou classname |

### Integration Points

| System | Integration Method |
|---|---|
| Supabase | Embedded select pra `operations` + `clients` + `frentes` + `allocations` numa query única (PostgREST foreign embed via FK nomeada) |
| Tailwind 4 | Classes diretas; sem `tailwind.config.ts`. Tokens já no `@theme inline` |
| Next 16 | Server Components default; `'use client'` só onde precisa (`usePathname`) |
| RLS | Já habilitado; user autenticado pode SELECT em tudo |
| Mockup canônico | `docs/mockup-v2.html` (na verdade arquivo `dryos-delivery-mockup-v2.html` na raiz) — referência visual; **não inventar** desvio |

---

## Components

### `src/lib/utils/cn.ts` — class merger

- **Purpose**: helper `cn(...inputs)` pra mesclar Tailwind classes evitando conflitos (`bg-oak` + `bg-card` → mantém o último).
- **Location**: `src/lib/utils/cn.ts`
- **Interfaces**: `export function cn(...inputs: ClassValue[]): string`
- **Dependencies**: `clsx` + `tailwind-merge` (instalar via npm)
- **Reuses**: padrão da indústria (shadcn/ui)

### `src/components/ui/Pill.tsx`

- **Purpose**: sistema canônico de status; pílula colorida com 6 variants.
- **Location**: `src/components/ui/Pill.tsx`
- **Interfaces**:
  - `type PillVariant = 'neutral' | 'oak' | 'sage' | 'ok' | 'warning' | 'critical'`
  - `function Pill({ variant?, showDot?, children, className? }: PillProps): JSX.Element`
- **Dependencies**: `cn`, React
- **Reuses**: snippet skill `dryos-design-system` (seção "Pill") **verbatim**, ajustado pra import path `@/lib/utils/cn`

### `src/components/ui/Card.tsx`

- **Purpose**: container canônico com radius 10, shadow-sm, border.
- **Location**: `src/components/ui/Card.tsx`
- **Interfaces**: `function Card({ children, className?, interactive? }): JSX.Element`
- **Dependencies**: `cn`
- **Reuses**: snippet skill verbatim

### `src/components/ui/Button.tsx`

- **Purpose**: botão com 3 variants e 2 sizes.
- **Location**: `src/components/ui/Button.tsx`
- **Interfaces**:
  - `type ButtonVariant = 'primary' | 'ghost' | 'sage'`
  - `type ButtonSize = 'sm' | 'md'`
  - `<Button variant size {...HTMLButtonAttributes}>`
- **Dependencies**: `cn`
- **Reuses**: estrutura do skill + cuidado: extends `React.ComponentProps<'button'>` pra aceitar `type`, `disabled`, `onClick`, etc.

### `src/components/layout/Sidebar.tsx`

- **Purpose**: barra lateral fixa esquerda com marca, navegação, footer com user.
- **Location**: `src/components/layout/Sidebar.tsx` (Server Component)
- **Interfaces**: `async function Sidebar(): Promise<JSX.Element>` — lê `getUser()` server-side
- **Dependencies**: `getUser`, `signOutAction`, `SidebarNav`, lucide icons (`LogOut`)
- **Estrutura**:
  - `<aside class="fixed left-0 top-0 h-screen w-[220px] bg-surface border-r border-line p-5 flex flex-col">`
  - Marca: `<h1 class="font-display text-lg text-ink">DRYOS</h1><span class="font-mono text-xs text-mute">— Delivery</span>`
  - `<SidebarNav />` (client)
  - Spacer (`flex-1`)
  - Footer: e-mail truncado + form com signOutAction

### `src/components/layout/SidebarNav.tsx`

- **Purpose**: links de navegação com destaque no link ativo.
- **Location**: `src/components/layout/SidebarNav.tsx`
- **Interfaces**: `function SidebarNav(): JSX.Element` — `'use client'`
- **Dependencies**: `usePathname` de `next/navigation`, `next/link`
- **Estrutura**: lista de links `{ href, label, icon }` → renderiza `<Link>` com `bg-oak-50 text-oak` quando ativo, `text-mute hover:text-ink` quando não

### `src/components/layout/PageHeader.tsx`

- **Purpose**: cabeçalho de página — título display + subtítulo + ações opcionais.
- **Location**: `src/components/layout/PageHeader.tsx`
- **Interfaces**:
  - `function PageHeader({ title, subtitle?, actions? }): JSX.Element`
  - `subtitle` aceita `string | ReactNode` pra permitir pills inline
  - `actions` é `ReactNode` (botões ou outros)
- **Dependencies**: nenhuma além de React

### `src/components/domain/OperationCard.tsx`

- **Purpose**: card de Operação na Home.
- **Location**: `src/components/domain/OperationCard.tsx`
- **Interfaces**:
  - `type OperationCardData = { id, clientName, operationName, productLine, status, firstFrente: { cycleType, actionableStatus, actionableStatusSince } | null, teamSize: number }`
  - `function OperationCard({ data }: { data: OperationCardData }): JSX.Element`
- **Dependencies**: `Pill`, `Card`, `Link` de `next/link`, helpers de formatação de data
- **Lógica**:
  - Wraps everything in `<Link href="/operations/{id}">` → `Card` `interactive`
  - Top row: linha pill (`oak`) + status pill (variante por status, mapeada)
  - Cliente em Funnel Display 600 20px, op name em mute
  - Status acionável (formato em prosa) + "desde DD/MM"
  - Footer: contagem time + pill ciclo

### `src/app/(app)/layout.tsx` (modificação)

- **Purpose**: wrapping com Sidebar + main com offset.
- **Location**: `src/app/(app)/layout.tsx`
- **Interfaces**: `async function AppLayout({ children }): Promise<JSX.Element>`
- **Estrutura**:
  ```tsx
  <div className="min-h-screen">
    <Sidebar />
    <main className="ml-[220px] max-w-[1280px] p-7">
      {children}
    </main>
  </div>
  ```

### `src/app/(app)/page.tsx` (substituição)

- **Purpose**: Home — saudação, tabs, grid de Operações.
- **Location**: `src/app/(app)/page.tsx`
- **Interfaces**: `async function Page(): Promise<JSX.Element>`
- **Lógica**:
  1. `const user = await getUser()`
  2. `const operations = await getActiveOperations()`
  3. `const counts = { em_construcao, em_operacao, janela_critica, todas: operations.length }` — calculada do array
  4. Render: `<PageHeader title={greeting(user)} subtitle={contextLine(operations)} />` + `<Tabs counts={counts} />` + grid de `OperationCard[]` (ou empty state)

### `src/app/(app)/operations/[id]/page.tsx` (placeholder)

- **Purpose**: destino do click no card. Por enquanto só uma mensagem.
- **Location**: `src/app/(app)/operations/[id]/page.tsx`
- **Interfaces**: `async function Page({ params }: { params: Promise<{ id: string }> }): Promise<JSX.Element>`
- **Conteúdo**: PageHeader + texto "Em construção · sem 03"

### `src/app/(app)/catalog/page.tsx` + `src/app/(app)/admin/page.tsx` (placeholders)

- **Purpose**: alvos dos links da sidebar. PageHeader + "Em construção".

### `src/lib/db/queries/operations.ts`

- **Purpose**: query tipada que retorna Operações com relações embedadas, mapeadas pro shape do card.
- **Location**: `src/lib/db/queries/operations.ts`
- **Interfaces**:
  - `async function getActiveOperations(): Promise<OperationCardData[]>`
  - Internamente: chama `createServer()`, faz select com `client:clients(name, slug)`, `frentes(id, name, cycle_type, actionable_status, actionable_status_since, created_at, allocations(id))`. Filtra `archived_at IS NULL` e `status != 'arquivada'`.
  - Mapeia: pega `frentes[0]` (sorted by `created_at asc`) como `firstFrente`; soma `allocations.length` por frente como `teamSize`.
- **Dependencies**: `createServer`, `Database`

### `supabase/seed/dev_demo.sql`

- **Purpose**: popular DB com 3 Operações + dependências, idempotente.
- **Location**: `supabase/seed/dev_demo.sql`
- **Estrutura**:
  ```sql
  -- 3 clients
  INSERT INTO public.clients (name, slug) VALUES
    ('Acme', 'acme'), ('Beta', 'beta'), ('Gama', 'gama')
  ON CONFLICT (slug) DO NOTHING;

  -- 3 operations (via subselect pra evitar hardcode de UUIDs)
  WITH c AS (SELECT id, slug FROM public.clients WHERE slug IN ('acme','beta','gama'))
  INSERT INTO public.operations (client_id, product_line, name, status, monthly_recurring_revenue, recurrence)
  SELECT
    (SELECT id FROM c WHERE slug='acme'), 'core'::product_line, 'Acme Core', 'em_operacao'::operation_status, 8500.00, 'mensal'::recurrence
  WHERE NOT EXISTS (SELECT 1 FROM public.operations WHERE name = 'Acme Core')
  UNION ALL
  SELECT (SELECT id FROM c WHERE slug='beta'), 'spark'::product_line, 'Beta Spark Inbox', 'em_operacao'::operation_status, 3200.00, 'mensal'::recurrence
  WHERE NOT EXISTS (SELECT 1 FROM public.operations WHERE name = 'Beta Spark Inbox')
  UNION ALL
  SELECT (SELECT id FROM c WHERE slug='gama'), 'studio'::product_line, 'Gama Studio Launch — Edicao 12', 'janela_critica'::operation_status, NULL, 'unica'::recurrence
  WHERE NOT EXISTS (SELECT 1 FROM public.operations WHERE name = 'Gama Studio Launch — Edicao 12');

  -- 3 frentes (uma por op)
  ...

  -- 2 persons (internal Rafael + Gabi)
  INSERT ... ON CONFLICT (name) DO NOTHING; -- NB: name não é UNIQUE; usar WHERE NOT EXISTS pattern
  ...

  -- 3 allocations
  ...
  ```
- **Idempotência**: usa `WHERE NOT EXISTS` em vez de `ON CONFLICT` onde unique key não existe (Frentes, Allocations, Persons).
- **Aplicação**: via MCP `execute_sql` (não é migration permanente; é seed dev).

---

## Data Models

Nenhuma mudança de schema. Apenas tipos derivados:

```typescript
// src/lib/db/queries/operations.ts (tipos internos)
import type { Database } from '@/lib/db/types';
type Op = Database['public']['Tables']['operations']['Row'];
type Client = Pick<Database['public']['Tables']['clients']['Row'], 'name' | 'slug'>;
type Frente = Pick<
  Database['public']['Tables']['frentes']['Row'],
  'id' | 'name' | 'cycle_type' | 'actionable_status' | 'actionable_status_since' | 'created_at'
>;

export type OperationCardData = {
  id: string;
  clientName: string;
  operationName: string;
  productLine: Op['product_line'];
  status: Op['status'];
  firstFrente: Frente | null;
  teamSize: number;
};
```

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
|---|---|---|
| Query Supabase falha (DB down, RLS error) | Server Component catches; renderiza `<ErrorBlock>` com "Não foi possível carregar Operações." + botão recarregar (link `/`) | Tela de erro discreta, sem stacktrace |
| Operações = 0 | Empty state — heading + texto + botão sage "Nova operação" (desabilitado por agora; placeholder pra `operations-crud`) | "Nenhuma Operação ativa." |
| Frente ausente em Op | Card omite status acionável + pill ciclo; mostra "— sem Frente ativa" no lugar do status | Card menos rico, mas legível |
| User null em `getUser` no Sidebar | Sidebar renderiza com placeholder "Anon" no footer (não deveria ocorrer porque proxy garante auth, mas safe) | Visual degradado, sem erro |
| Click em card antes do `/operations/[id]` placeholder existir | 404 do Next | Por isso T inclui criar o placeholder |

---

## Tech Decisions

| Decision | Choice | Rationale |
|---|---|---|
| `Icon` component wrapper | **Skip** | Lucide React já oferece componentes tipados. Wrapper só adicionaria sintaxe sem valor. Usar `<LogOut className="w-4 h-4" />` direto. |
| `cn` helper localização | `src/lib/utils/cn.ts` | Skill DS referencia `@/lib/utils`; padrão shadcn. Combo `clsx + tailwind-merge`. |
| Query strategy (Home) | Uma chamada com embed de `clients`, `frentes`, `allocations` | Reduz round-trips. PostgREST suporta nested select natural via FK. Não precisa view nem stored proc. |
| Mapping de status pra Pill variant | Função inline (pequena) | `em_operacao` → sage, `janela_critica` → warning, `em_construcao` → neutral, `arquivada` → neutral (mas filtrado antes). |
| Mapping de productLine pra Pill label | Capitalização simples ("core" → "Core") | Sem necessidade de i18n table; UI sempre em pt-BR. |
| Seed: migration vs seed file | **Seed file** em `supabase/seed/dev_demo.sql`, NÃO migration | Dados dev/demo não devem ir como migration permanente (CLAUDE.md "Migration conventions"). Aplica via MCP execute_sql; some quando user roda DELETE. |
| Idempotência do seed | `WHERE NOT EXISTS` por nome/slug | `ON CONFLICT` requer unique constraint; só `clients.slug` tem. Frentes/Persons/Allocations dependem do pattern WHERE NOT EXISTS. |
| Sidebar links inativos (Catálogo, Painel) | Páginas placeholder existem mas só renderizam "Em construção · sem 04/05" | Evita 404 ao clicar; experiência limpa |
| Active state da SidebarNav | Client Component com `usePathname` | Padrão Next 16. Único trecho que precisa `'use client'`. |
| Operação Card click → navegação | `<Link href="/operations/{id}">` envolvendo o `<Card interactive>` | Native HTML; sem JS extra. Acessibilidade: foco/teclado funciona out-of-the-box. |
| Where Sidebar Logout button lives | `<form action={signOutAction}>` minimal no footer do Sidebar | Reusa Server Action de `auth.ts` |
| Botão "sair" temporário em `(app)/page.tsx` | **Remover** (vai pro Sidebar) | UI corrige; Sidebar agora tem o botão canônico |

---

## Notes

- **Tailwind 4 + dynamic class names**: o mapping de status→variant é evaluado em runtime, mas as classes finais (`bg-sage-bg text-sage-deep`, etc) estão hardcoded em `Pill.tsx` — Tailwind 4 detecta. Sem JIT issues.
- **Hierarquia tipográfica**: nome do cliente no card é Funnel Display 600 20px (`font-display text-xl font-semibold`). Status acionável é Onest 14 mute (`font-body text-sm text-mute`). PageHeader title é Funnel Display 600 32px (`font-display text-3xl font-semibold`).
- **Spacing scale**: padding canônico do skill é `p-5` em Card e `p-7` em main. Mantém.
- **Grid responsivo**: `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`. Empty state usa `col-span-full`.
- **Visibility do skip de Icon**: comentar em `src/components/ui/` no índice (não criamos `ui/Icon.tsx` — Lucide importado direto onde usado).
