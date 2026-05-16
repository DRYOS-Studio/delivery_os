# home-and-ui-foundation Tasks

**Design**: `.specs/features/home-and-ui-foundation/design.md`
**Status**: Draft

---

## Execution Plan

```
Phase 1 — Foundations:
  T1 (npm install) ─┐
                    ├─→ T2 (cn) ─┬─→ T3 (Pill) [P]
                    │            ├─→ T4 (Card) [P]
                    │            └─→ T5 (Button) [P]
                    │
                    └─→ (lucide-react usado em T7+)

Phase 2 — Layout (após T2):
  T6 (SidebarNav client) ─┐
                          ├─→ T7 (Sidebar server) [usa T6 + Lucide]
  T8 (PageHeader) [P]

Phase 3 — Data + Domain (paralelo com Phase 2):
  T9 (queries/operations.ts) ─→ T10 (OperationCard) [usa T3+T4]

Phase 4 — Pages (após T7, T8, T10):
  T11 (Home) ──┐
  T12 (layout) ┼─→ done
  T13 (3 placeholders)

Phase 5 — Seed + E2E:
  T14 (dev_demo.sql) → T15 (apply via MCP) → T16 (build + visual E2E)
```

Caminho crítico: T1 → T2 → T7 → T11 → T16.

---

## Task Breakdown

### T1: Instalar `lucide-react` + `clsx` + `tailwind-merge`

**What**: 3 deps mínimas pros componentes.
**Where**: `package.json` + `package-lock.json`
**Depends on**: None
**Reuses**: nada

**Tools**: Bash (`npm install`)

**Done when**:
- [ ] `lucide-react`, `clsx`, `tailwind-merge` em `package.json` (`dependencies`)
- [ ] `npm install` rodou sem erro
- [ ] `npm run typecheck` passa

**Verify**:
```bash
node -e "const d=require('./package.json').dependencies; \
  process.exit(d['lucide-react'] && d['clsx'] && d['tailwind-merge'] ? 0 : 1)"
```

---

### T2: `src/lib/utils/cn.ts`

**What**: helper `cn(...inputs)` que mescla classes Tailwind sem conflito.
**Where**: `src/lib/utils/cn.ts`
**Depends on**: T1
**Reuses**: padrão shadcn

**Tools**: Write

**Done when**:
- [ ] Exporta `function cn(...inputs: ClassValue[]): string` usando `twMerge(clsx(inputs))`
- [ ] `ClassValue` reexportado ou inferido do clsx
- [ ] `npm run typecheck` passa

**Verify**:
```bash
grep -q "twMerge" src/lib/utils/cn.ts && npm run typecheck
```

---

### T3: `src/components/ui/Pill.tsx` [P]

**What**: componente canônico de status com 6 variants.
**Where**: `src/components/ui/Pill.tsx`
**Depends on**: T2
**Reuses**: skill `dryos-design-system` (seção "Pill") verbatim

**Tools**: Write
**Skill**: `dryos-design-system`

**Done when**:
- [ ] Types `PillVariant = 'neutral' | 'oak' | 'sage' | 'ok' | 'warning' | 'critical'`
- [ ] Props: `variant?`, `showDot?`, `children`, `className?`
- [ ] Mapping de cores per skill
- [ ] Classes base: `inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[10px] font-medium rounded-pill whitespace-nowrap`
- [ ] `npm run typecheck` passa

**Verify**: typecheck + visual smoke depois.

---

### T4: `src/components/ui/Card.tsx` [P]

**What**: container canônico.
**Where**: `src/components/ui/Card.tsx`
**Depends on**: T2
**Reuses**: skill seção "Card" verbatim

**Tools**: Write

**Done when**:
- [ ] Props: `children`, `className?`, `interactive?`
- [ ] Classes base: `bg-card border border-line rounded shadow-sm p-5`
- [ ] Interactive adiciona `cursor-pointer transition-all hover:shadow-md hover:-translate-y-px hover:border-line-strong`
- [ ] `npm run typecheck` passa

---

### T5: `src/components/ui/Button.tsx` [P]

**What**: 3 variants × 2 sizes.
**Where**: `src/components/ui/Button.tsx`
**Depends on**: T2
**Reuses**: skill seção "Botão" + fechamento de tipos

**Tools**: Write

**Done when**:
- [ ] Types `ButtonVariant = 'primary' | 'ghost' | 'sage'`, `ButtonSize = 'sm' | 'md'`
- [ ] Props estendem `React.ComponentProps<'button'>` + variant/size opcionais
- [ ] Variants: `primary` = `bg-ink text-bg hover:bg-oak`; `ghost` = `bg-card text-ink-soft border border-line-strong hover:bg-surface hover:border-ink`; `sage` = `bg-sage text-ink hover:bg-sage-deep hover:text-bg`
- [ ] Sizes: `sm` = `px-2.5 py-1 text-[11px]`, `md` = `px-3.5 py-2 text-[13px]`
- [ ] Base: `inline-flex items-center gap-2 rounded font-medium transition-colors disabled:opacity-50`
- [ ] `npm run typecheck` passa

---

### T6: `src/components/layout/SidebarNav.tsx`

**What**: links de navegação com destaque ativo via `usePathname`.
**Where**: `src/components/layout/SidebarNav.tsx`
**Depends on**: T2 (cn)
**Reuses**: Lucide icons

**Tools**: Write

**Done when**:
- [ ] `'use client'` no topo
- [ ] Lista hardcoded: `[{href:'/',label:'Home',icon:Home}, {href:'/catalog',label:'Catálogo',icon:Settings}, {href:'/admin',label:'Painel',icon:LayoutDashboard}]`
- [ ] Mapea pra `<Link>` com classe condicional:
  - Ativo: `bg-oak-50 text-oak`
  - Inativo: `text-mute hover:text-ink hover:bg-surface`
- [ ] Item: `flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm font-medium`
- [ ] Ícone tamanho `w-4 h-4`
- [ ] `npm run typecheck` passa

---

### T7: `src/components/layout/Sidebar.tsx`

**What**: barra lateral fixa com marca, nav, e footer com user + logout.
**Where**: `src/components/layout/Sidebar.tsx`
**Depends on**: T6 (SidebarNav), T1 (lucide LogOut)
**Reuses**: `getUser`, `signOutAction`

**Tools**: Write

**Done when**:
- [ ] Server Component (`async function Sidebar()`)
- [ ] `<aside class="fixed left-0 top-0 h-screen w-[220px] bg-surface border-r border-line p-5 flex flex-col">`
- [ ] Topo: marca DRYOS / Delivery (display + mono) com margin-bottom
- [ ] `<SidebarNav />`
- [ ] `<div class="flex-1" />`
- [ ] Footer: container com `border-t border-line pt-3 mt-3 flex items-center gap-2`
  - E-mail truncado em mono text-xs text-mute, `truncate flex-1`
  - `<form action={signOutAction}>` com `<button>` contendo `<LogOut className="w-4 h-4" />` + `text-mute hover:text-ink`
- [ ] `npm run typecheck` passa

---

### T8: `src/components/layout/PageHeader.tsx` [P]

**What**: header de página — título + subtítulo + ações.
**Where**: `src/components/layout/PageHeader.tsx`
**Depends on**: T2 (cn opcional)

**Tools**: Write

**Done when**:
- [ ] Props: `title: string`, `subtitle?: React.ReactNode`, `actions?: React.ReactNode`
- [ ] `<header class="flex items-start justify-between mb-7">`
  - Esquerda: `<div><h1 class="font-display text-3xl font-semibold text-ink">{title}</h1>{subtitle && <p class="font-body text-sm text-mute mt-1">{subtitle}</p>}</div>`
  - Direita: `{actions && <div>{actions}</div>}`
- [ ] `npm run typecheck` passa

---

### T9: `src/lib/db/queries/operations.ts`

**What**: query tipada que retorna operações com client + frentes + allocations.
**Where**: `src/lib/db/queries/operations.ts`
**Depends on**: nenhuma técnica

**Tools**: Write

**Done when**:
- [ ] Exporta `type OperationCardData` (per design)
- [ ] Exporta `async function getActiveOperations(): Promise<OperationCardData[]>`
- [ ] Internamente:
  - `const supabase = await createServer()`
  - `supabase.from('operations').select('id, name, status, product_line, client:clients(name, slug), frentes(id, name, cycle_type, actionable_status, actionable_status_since, created_at, allocations(id))').is('archived_at', null).neq('status', 'arquivada').order('created_at', { ascending: false })`
  - Erro → throw com mensagem ou catch + return []
  - Map: pega `frentes[0]` ordenado por `created_at asc` como `firstFrente`; soma `allocations.length` por todas frentes como `teamSize`
- [ ] Tipos derivados de `Database['public']['Tables']['operations']['Row']` etc
- [ ] `npm run typecheck` passa

**Verify**:
```bash
grep -q "getActiveOperations" src/lib/db/queries/operations.ts && npm run typecheck
```

---

### T10: `src/components/domain/OperationCard.tsx`

**What**: card de Operação renderizando `OperationCardData`.
**Where**: `src/components/domain/OperationCard.tsx`
**Depends on**: T3 (Pill), T4 (Card), T9 (type OperationCardData)
**Reuses**: skill DS

**Tools**: Write

**Done when**:
- [ ] Props: `data: OperationCardData`
- [ ] Wrap em `<Link href={`/operations/${data.id}`} class="block">` + `<Card interactive>`
- [ ] Top: `<div class="flex items-center gap-2 mb-4">` com 2 pills:
  - `<Pill variant="oak">{productLineLabel(data.productLine)}</Pill>` (helper: 'core'→'Core', 'spark'→'Spark', 'studio'→'Studio')
  - `<Pill variant={statusVariant(data.status)}>{statusLabel(data.status)}</Pill>` (helper: em_operacao→sage 'Em operação', janela_critica→warning 'Janela crítica', em_construcao→neutral 'Em construção')
- [ ] Cliente: `<h3 class="font-display text-xl font-semibold text-ink">{clientName}</h3>`
- [ ] Op: `<p class="font-body text-sm text-mute">{operationName}</p>`
- [ ] Se `firstFrente`: bloco com status acionável `<p class="font-mono text-xs text-mute mt-4 leading-relaxed">{actionable_status}</p>` + "desde {DD/MM}"
- [ ] Footer: `<div class="flex items-center justify-between mt-5 pt-4 border-t border-line">`
  - Esquerda: `<span class="font-mono text-xs text-mute">{teamSize} {teamSize === 1 ? 'pessoa' : 'pessoas'} alocadas</span>`
  - Direita (se firstFrente): `<Pill variant="neutral">Tipo {cycle_type.toUpperCase()}</Pill>`
- [ ] `npm run typecheck` passa

---

### T11: `src/app/(app)/page.tsx` (substituir placeholder pela Home)

**What**: Home com saudação, tabs estáticas, grid de cards.
**Where**: `src/app/(app)/page.tsx`
**Depends on**: T7, T8, T9, T10
**Reuses**: `getUser`, `getActiveOperations`, `PageHeader`, `OperationCard`, `Pill`

**Tools**: Write

**Done when**:
- [ ] `async function Page()`
- [ ] Lê `user` e `operations`
- [ ] Saudação: helper `greeting(hour, email)` → "Bom dia/tarde/noite, {nameFromEmail(email)}."
  - **Override do CLAUDE.md memória**: se o email for `rafaelemeth@gmail.com`, usar nome `Rafael` (não `Rafaelemeth`). Caso geral: capitaliza prefixo do e-mail.
- [ ] Contexto: `"{N} Operações ativas · {M} em janela crítica"` (calculado do array)
- [ ] `<PageHeader title={greeting} subtitle={contextLine} />`
- [ ] Tabs row: 4 pills inline (apenas "Em operação" ativa visualmente):
  - Container: `<div class="flex gap-2 mb-7">`
  - Cada tab é um `<div>` (não clicável): classes `inline-flex items-center gap-2 px-3 py-1.5 rounded-pill text-sm font-medium` + variant
  - Ativa: `bg-card text-ink border border-line-strong`
  - Inativa: `bg-transparent text-mute`
  - Contagem inline `<Pill variant="neutral">{count}</Pill>`
- [ ] Grid: `<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">` ou empty state
- [ ] Empty state: `<div class="col-span-full text-center py-14"><p class="font-display text-xl text-mute">Nenhuma Operação ativa.</p><p class="font-body text-sm text-mute mt-2">Aguarde o convite do admin ou abra uma nova.</p></div>`
- [ ] Botão "sair" removido (vai no Sidebar agora)
- [ ] `npm run typecheck` + `npm run build` passa

---

### T12: `src/app/(app)/layout.tsx` (adicionar Sidebar wrapper)

**What**: substituir o fragmento pelo layout com Sidebar.
**Where**: `src/app/(app)/layout.tsx`
**Depends on**: T7

**Tools**: Edit

**Done when**:
- [ ] Renderiza `<div class="min-h-screen"><Sidebar /><main class="ml-[220px] max-w-[1280px] p-7">{children}</main></div>`
- [ ] `npm run typecheck` + `npm run build` passa

---

### T13: Placeholder pages [P × 3]

**What**: 3 páginas placeholder com PageHeader + texto "Em construção".
**Where**:
- `src/app/(app)/operations/[id]/page.tsx`
- `src/app/(app)/catalog/page.tsx`
- `src/app/(app)/admin/page.tsx`
**Depends on**: T8 (PageHeader)

**Tools**: Write (3 arquivos similares)

**Done when**:
- [ ] `operations/[id]/page.tsx`: `async function Page({ params }: { params: Promise<{ id: string }> })`; PageHeader `title="Operação"` `subtitle="Em construção · sem 03"`; texto curto.
- [ ] `catalog/page.tsx`: PageHeader `title="Catálogo"` `subtitle="Em construção · sem 04"`
- [ ] `admin/page.tsx`: PageHeader `title="Painel do Admin"` `subtitle="Em construção · sem 05"`
- [ ] `npm run typecheck` + `npm run build` passa

---

### T14: `supabase/seed/dev_demo.sql`

**What**: seed idempotente com 3 clientes + 3 ops + 3 frentes + 2 persons + 3 allocations.
**Where**: `supabase/seed/dev_demo.sql`
**Depends on**: nenhuma técnica (schema já existe)

**Tools**: Write

**Done when**:
- [ ] 3 clients via `INSERT ... ON CONFLICT (slug) DO NOTHING`
- [ ] 3 operations via `INSERT ... SELECT ... WHERE NOT EXISTS (SELECT 1 FROM operations WHERE name = ...)`
- [ ] 3 frentes (mesmo pattern WHERE NOT EXISTS por (operation_id, name)). Status acionáveis ≥15 chars, NÃO genéricos.
- [ ] 2 persons (internal) — WHERE NOT EXISTS por (name, kind)
- [ ] 3 allocations — WHERE NOT EXISTS por (person_id, frente_id, role)
- [ ] Comentários SQL explicando intenção
- [ ] Arquivo sintaticamente válido (testar em T15)

---

### T15: Aplicar seed via MCP `execute_sql`

**What**: rodar o arquivo de T14 no projeto remoto.
**Where**: Supabase project `tmsaucxoeqpfluzwrwkc`
**Depends on**: T14

**Tools**: MCP `execute_sql` (passar o conteúdo do arquivo)

**Done when**:
- [ ] Seed roda sem erro
- [ ] `SELECT count(*) FROM clients` retorna ≥3
- [ ] `SELECT count(*) FROM operations` retorna ≥3
- [ ] `SELECT count(*) FROM frentes` retorna ≥3
- [ ] `SELECT count(*) FROM persons WHERE kind='internal'` retorna ≥2
- [ ] `SELECT count(*) FROM allocations` retorna ≥3
- [ ] Re-aplicar: counts não mudam (idempotência confirmada)

**Verify (via MCP):**
```sql
SELECT
  (SELECT count(*) FROM clients) AS c,
  (SELECT count(*) FROM operations) AS o,
  (SELECT count(*) FROM frentes) AS f,
  (SELECT count(*) FROM persons WHERE kind='internal') AS p,
  (SELECT count(*) FROM allocations) AS a;
```

---

### T16: Build + visual E2E

**What**: validar tudo localmente + produção.
**Where**: worktree local + URL prod
**Depends on**: T1-T15

**Tools**: Bash + browser

**Done when**:
- [ ] `npm run typecheck` + `npm run build` verdes
- [ ] Local: `npm run dev` → http://localhost:3000 logado → ver Sidebar + Home com 3 cards + tabs estáticas
- [ ] Click num card → `/operations/{id}` mostra "Em construção · sem 03"
- [ ] Click "Catálogo" / "Painel" → respectivos placeholders
- [ ] Logout pela Sidebar funciona → cai em `/login`
- [ ] Após push + merge: produção (`https://delivery-os-phi.vercel.app/`) idem
- [ ] Visual confere com `dryos-delivery-mockup-v2.html` (cores, pills, tipografia)

---

## Parallel Execution Map

```
Phase 1:
  T1 ──→ T2 ──┬──→ T3 [P]
              ├──→ T4 [P]
              └──→ T5 [P]

Phase 2 (após T2, paralelo com Phase 3):
  T6 ──→ T7      (Sidebar precisa de T6 + Lucide de T1)
  T8 [P]

Phase 3 (após T2, paralelo com Phase 2):
  T9 ──→ T10 (depende de T3, T4, T9)

Phase 4 (após T7, T8, T10):
  T11 ─┐
  T12 ─┼─→ done
  T13 [P×3]

Phase 5:
  T14 → T15 → T16
```

Caminho crítico: T1 → T2 → T9 → T10 → T11 → T15 → T16.

---

## Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1 install | 1 ação (npm) | ✅ |
| T2 cn | 1 arquivo | ✅ |
| T3 Pill | 1 componente | ✅ |
| T4 Card | 1 componente | ✅ |
| T5 Button | 1 componente | ✅ |
| T6 SidebarNav | 1 componente client | ✅ |
| T7 Sidebar | 1 componente | ✅ |
| T8 PageHeader | 1 componente | ✅ |
| T9 query | 1 arquivo | ✅ |
| T10 OperationCard | 1 componente | ✅ |
| T11 Home | 1 arquivo (cohesivo: header + tabs + grid) | ✅ |
| T12 layout edit | 1 arquivo | ✅ |
| T13 3 placeholders | 3 arquivos similares | ✅ (cohesivo) |
| T14 seed SQL | 1 arquivo | ✅ |
| T15 apply | 1 ação MCP | ✅ |
| T16 E2E | 1 sessão de validação | ✅ |

---

## Tools Summary

| Task | Tools | Skill |
|---|---|---|
| T1 | Bash (npm install) | — |
| T2 | Write | — |
| T3-T5 | Write | `dryos-design-system` |
| T6 | Write | `dryos-design-system` |
| T7 | Write | `dryos-design-system` |
| T8 | Write | `dryos-design-system` |
| T9 | Write | `dryos-conventions` (Queries Supabase) |
| T10 | Write | `dryos-design-system` |
| T11 | Write | `dryos-design-system` |
| T12 | Edit | — |
| T13 | Write × 3 | — |
| T14 | Write | `dryos-conventions` (Migrations, sintaxe SQL) |
| T15 | MCP `execute_sql` | — |
| T16 | Bash + curl + browser | — |

---

## Pre-Implementation Confirmation

Pace pra implementação:
- Reto T1→T16 (estimativa: ~25-30 min de fluxo), pauso só se quebrar?
- Ou pausa em cada Phase (4 pausas)?
