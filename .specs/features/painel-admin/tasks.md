# painel-admin Tasks

**Design**: `.specs/features/painel-admin/design.md`

---

## Execution Plan

```
Phase 1 — Queries:
  T1 (dashboard.ts: getDashboardSummary, getTopClientsByMRR, getTopVillainsByFrequency)

Phase 2 — UI primitives:
  T2 (MetricCard component)
  T3 (HorizontalBarChart client wrapper)

Phase 3 — Domain sections:
  T4 (DashboardMRRSection: MRR card + top clients chart)
  T5 (DashboardCountsGrid: 4 counts)
  T6 (DashboardVillainsSection: top vilões chart + QW 30d)
  T7 (DashboardPersonsSection: 3 counts)

Phase 4 — Page + nav:
  T8 (/admin/dashboard page.tsx com requireAdmin + Promise.all)
  T9 (SidebarNav: add Painel item, rename /admin to Admin, exactMatch flag)

Phase 5 — Ship:
  T10 (typecheck + build + smoke admin + verify MRR SQL bate)
  T11 (issue + PR + merge)
```

Caminho crítico: T1→T2,T3→T4-T7→T8→T9→T10→T11. ~60-80min (leve, sem migration).

---

## Task Breakdown

### T1: queries/dashboard.ts

- [ ] Criar `src/lib/db/queries/dashboard.ts`
- [ ] Type `DashboardSummary` (9 campos: mrrTotal, activeOps, archivedOps, frentesHealthy, frentesStale, qwLast30d, internalPersons, externalPersons, openAllocations)
- [ ] Type `ClientMRR` (clientId, name, mrr)
- [ ] Type `VillainFrequency` (villainId, name, count)
- [ ] `getDashboardSummary()`:
  - Fetch operations (id, client_id, monthly_recurring_revenue, archived_at) — count active/archived + sum MRR num único fetch
  - Fetch frentes não-arquivadas (id, actionable_status, updated_at) — filtrar healthy vs stale com threshold 14d
  - Count quick_wins WHERE created_at >= now() - 30d (head:true)
  - Count persons WHERE kind=internal + archived_at IS NULL (head:true)
  - Count persons WHERE kind=external + archived_at IS NULL (head:true)
  - Count allocations WHERE end_date IS NULL (head:true)
  - Promise.all dos counts; retorna DashboardSummary
- [ ] `getTopClientsByMRR(limit=5)`:
  - Fetch operations com join `clients!inner(id, name)` filtrado por archived_at null
  - Map agregado por client_id, soma MRR
  - Filter mrr > 0, sort DESC, slice limit
  - Cast manual do shape do clients (não array)
- [ ] `getTopVillainsByFrequency(limit=5)`:
  - Fetch operation_villains com join `villains!inner(id, name, archived_at)` filtrando villains não-arquivados
  - Map agregado por villain_id, count
  - Sort DESC, slice limit
- [ ] Throws padronizados `dashboard.<fn>: <message>`

---

### T2: MetricCard component

- [ ] Criar `src/components/ui/MetricCard.tsx` (server)
- [ ] Props: `label`, `value` (number | string), `hint?`, `variant?` (PillVariant)
- [ ] Render: card surface com border-line, padding p-5:
  - Label `font-mono text-xs uppercase tracking-wide text-mute`
  - Value `font-display text-3xl font-semibold text-ink`
  - Hint opcional `text-xs text-mute mt-1`
  - Se `variant` → Pill colorido no topo direito ou accent border-left
- [ ] Sem ícones (consistent simplicidade)

---

### T3: HorizontalBarChart client wrapper

- [ ] Criar `src/components/ui/HorizontalBarChart.tsx`
- [ ] `"use client";` no topo
- [ ] Import `BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell` de recharts
- [ ] Props: `data: { label: string; value: number }[]`, `formatValue?: (n) => string`, `height?: number` (default 240), `color?: string` (default sage var)
- [ ] Empty state: se `data.length === 0` → render `<p text-mute>Sem dados</p>` (não renderiza chart)
- [ ] ResponsiveContainer 100% width
- [ ] BarChart layout="vertical", margin sensata
- [ ] YAxis dataKey="label" type="category" width=120, tickFormatter trunca >20 chars
- [ ] XAxis type="number" hide
- [ ] Bar dataKey="value" fill={color} radius=[0, 2, 2, 0]
- [ ] Tooltip custom (ou padrão com formatter) mostrando `formatValue(value) ?? value`

---

### T4: DashboardMRRSection

- [ ] Criar `src/components/domain/DashboardMRRSection.tsx` (server)
- [ ] Props: `mrrTotal: number`, `activeOperations: number`, `topClients: ClientMRR[]`
- [ ] Layout: card grande de MRR no topo + abaixo subtítulo "Top Clientes por MRR" + HorizontalBarChart
- [ ] MRR card: usa MetricCard com value=`formatMoneyBR(mrrTotal)`, hint=`${activeOperations} operações ativas`
- [ ] Chart data: `topClients.map(c => ({ label: c.name, value: c.mrr }))`
- [ ] formatValue={formatMoneyBR}
- [ ] Empty: HorizontalBarChart já trata

---

### T5: DashboardCountsGrid

- [ ] Criar `src/components/domain/DashboardCountsGrid.tsx` (server)
- [ ] Props: `activeOperations`, `archivedOperations`, `frentesHealthy`, `frentesStale`
- [ ] Grid `grid-cols-2 md:grid-cols-4 gap-3`:
  - "Operações ativas" — sage Pill
  - "Operações arquivadas" — neutral Pill
  - "Frentes saudáveis" — sage Pill
  - "Frentes stale (>14d)" — warning Pill (ou critical se > 5)
- [ ] Header h2 "Status"

---

### T6: DashboardVillainsSection

- [ ] Criar `src/components/domain/DashboardVillainsSection.tsx` (server)
- [ ] Props: `topVillains: VillainFrequency[]`, `quickWinsLast30d: number`
- [ ] Header h2 "Vilões & Quick Wins"
- [ ] Layout split: chart à esquerda (Top vilões por frequência) + 1 MetricCard à direita (QW 30d)
  - Ou empilhar em mobile
- [ ] Chart data: `topVillains.map(v => ({ label: v.name, value: v.count }))`
- [ ] formatValue: `(n) => ${n} operação${n > 1 ? "ões" : ""}`
- [ ] QW card: MetricCard value=quickWinsLast30d, hint="Últimos 30 dias", label="Quick Wins"

---

### T7: DashboardPersonsSection

- [ ] Criar `src/components/domain/DashboardPersonsSection.tsx` (server)
- [ ] Props: `internalPersons`, `externalPersons`, `openAllocations`
- [ ] Header h2 "Time & Alocações"
- [ ] Grid 3 colunas com MetricCards:
  - "Pessoas internas" (neutral)
  - "Pessoas externas" (neutral)
  - "Alocações abertas" (sage)

---

### T8: /admin/dashboard page

- [ ] Criar `src/app/(app)/admin/dashboard/page.tsx`
- [ ] `await requireAdmin()`
- [ ] `Promise.all([getDashboardSummary(), getTopClientsByMRR(5), getTopVillainsByFrequency(5)])`
- [ ] PageHeader title="Painel" subtitle="Visão agregada: receita, saúde, capacidade e tração."
- [ ] Container `flex flex-col gap-8`
- [ ] 4 sections na ordem: MRR → Counts → Villains → Persons

---

### T9: SidebarNav update

- [ ] Editar `src/components/layout/SidebarNav.tsx`
- [ ] Adicionar `exactMatch?: boolean` em NavItem type
- [ ] Lógica de active state: se `item.exactMatch`, usar `pathname === item.href`; senão padrão atual
- [ ] adminGroup items:
  1. `{ href: "/admin/dashboard", label: "Painel", icon: LayoutDashboard }` (novo)
  2. `{ href: "/catalog", label: "Catálogo", icon: BookOpen }`
  3. `{ href: "/admin", label: "Admin", icon: Settings, exactMatch: true }` (renomeado + exactMatch)
- [ ] Import `Settings` de lucide-react
- [ ] Verificar visualmente: estar em `/admin/dashboard` ativa apenas "Painel"; estar em `/admin` ativa apenas "Admin"; estar em `/admin/users/xyz` (se vier no futuro) ativa "Admin"

---

### T10: Typecheck + build + smoke + SQL check

- [ ] `npm run build` (sem warnings novos)
- [ ] Smoke como admin:
  - Sidebar mostra 3 items no group Admin: Painel, Catálogo, Admin
  - `/admin/dashboard` carrega
  - MRR card mostra valor formatado em R$
  - BarChart clientes renderiza com top N
  - 4 cards counts batem com SQL manual
  - Section vilões renderiza chart + QW count
  - 3 cards pessoas renderizam
- [ ] Smoke como member (rebaixar via setUserRoleAction ou criar second user):
  - Group Admin não aparece (já garantido em profiles feature)
  - `/admin/dashboard` URL direta → redirect `/`
- [ ] SQL verify via MCP execute_sql:
  ```sql
  SELECT
    sum(monthly_recurring_revenue) FILTER (WHERE archived_at IS NULL) AS mrr,
    count(*) FILTER (WHERE archived_at IS NULL) AS active_ops,
    count(*) FILTER (WHERE archived_at IS NOT NULL) AS archived_ops
  FROM operations;
  ```
  vs card no UI
- [ ] Screenshots: dashboard completo + smoke member redirect

---

### T11: Issue + PR + merge

- [ ] gh issue create
- [ ] Commit com mensagem imperativa
- [ ] gh pr create com `Closes #N`

---

## Pre-Impl

Pace: reto T1→T10, pauso antes do PR. ~60-80min.

**Riscos**:
- T1: tipos Supabase em joins (`clients!inner`, `villains!inner`) vêm como array no gerador. Cast com type local ou type guard. Verificar `Database["public"]` types em `src/lib/db/types.ts`.
- T3: Recharts SSR — confirmar `"use client"`. Bundle inflado mas aceitável (admin only).
- T9: active state edge — `/admin` vs `/admin/dashboard`. exactMatch flag novo precisa não quebrar items existentes (clients, operations etc tem subrotas `/clients/[id]`).
- T9: visual check do nav após renomeação ("Painel admin" → "Admin"). Outros lugares no app referenciam o rótulo? Buscar literal.
- T6 layout split: validar responsividade mobile (stack vertical em sm:).
