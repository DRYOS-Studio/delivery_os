# Design: home-dashboard

**Spec:** [spec.md](./spec.md) · **Issue:** [#84](https://github.com/rafaelemeth/delivery_os/issues/84)
**Status:** DESIGN

---

## Decisões resolvidas

| ID | Decisão |
|---|---|
| **D1** | Widget de vilões **mantido** pro member (RLS filtra pelas ops dele). |
| **D2** | Faixa KPI em **1 linha responsiva**: `grid-cols-2 md:grid-cols-3 xl:grid-cols-6` (admin) / `xl:grid-cols-4` (member). |
| **D3** | Tabs **funcionais** — filtram cards via searchParam `?status=`. |
| **D4** | Cards de operação: `grid-cols-1 2xl:grid-cols-2` dentro da coluna principal. |

---

## Estrutura da página (`src/app/(app)/page.tsx`)

Server Component. Fluxo:

```ts
const { status } = await searchParams;           // ?status= filtro
const profile = await getProfile();
const isAdmin = profile?.role === "admin";

const [summary, operations, attentionFrentes, hotCriticalCount, topVillains] =
  await Promise.all([
    getDashboardSummary(),
    getActiveOperations(),
    listFrentesNeedingAttention(),
    countHotCriticalFrentes(),
    getTopVillainsByFrequency(5),
  ]);
```

- `getProfile()` separado (não no Promise.all) ou junto — junto é fine.
- Não chama `getTopClientsByMRR` (admin financeiro fica na faixa KPI via summary; top-clientes não entra na Home — é deep-dive do /admin/dashboard).

### Filtro de status (D3)

- `status` ∈ `em_construcao | em_operacao | janela_critica | todas` (default `todas`).
- Normaliza via helper `normalizeStatusFilter(raw)`.
- `filteredOps = status === "todas" ? operations : operations.filter(o => o.status === status)`.
- Counts pra tabs vêm de `countByStatus(operations)` (do total, não do filtrado).

### Composição JSX

```
<PageHeader title="Olá, {nome}" subtitle="{greeting + resumo}" actions={admin? NovaOp} />

<HomeKpiStrip summary={summary} isAdmin={isAdmin} />   // faixa full width

<div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-8">
  <div className="xl:col-span-2 flex flex-col gap-7">
    <HomeStatusTabs counts={counts} active={status} />   // Link tabs c/ ?status=
    <FrentesAttentionSection frentes={attentionFrentes} hotCriticalCount={hotCriticalCount} />
    <OperationsGrid operations={filteredOps} isAdmin={isAdmin} />  // empty states aqui
  </div>
  <aside className="xl:col-span-1">
    <HomeSidebar isAdmin={isAdmin} topVillains={topVillains} quickWinsLast30d={summary.quickWinsLast30d} />
  </aside>
</div>
```

---

## Componentes

### `HomeKpiStrip` (novo, server) — `src/components/domain/HomeKpiStrip.tsx`

```ts
type Props = { summary: DashboardSummary; isAdmin: boolean };
```

Renderiza `MetricCard`s:
- Sempre: Ops ativas (`activeOperations`), Frentes saudáveis (`frentesHealthy`), Frentes paradas (`frentesStale`, variant `warning` se >0), Tasks abertas (`openTasks`).
- Admin only: MRR (`mrrTotal`, money), Margem (`monthlyMarginTotal`, money, variant `critical` se <0).
- Container: `grid grid-cols-2 md:grid-cols-3 gap-3 ${isAdmin ? "xl:grid-cols-6" : "xl:grid-cols-4"}`.

### `HomeStatusTabs` (novo, server) — `src/components/domain/HomeStatusTabs.tsx`

```ts
type Props = {
  counts: { em_construcao: number; em_operacao: number; janela_critica: number; todas: number };
  active: StatusFilter;
};
```

- Cada tab é `<Link href={status==='todas' ? '/' : '/?status=' + key} scroll={false}>`.
- Estilo ativo replica o atual (bg-card border-line-strong vs text-mute) — extrai do page.tsx atual.
- Pill com count.

### `OperationsGrid` (novo, server) — `src/components/domain/OperationsGrid.tsx`

Extrai o bloco de cards + empty state do page.tsx atual.
```ts
type Props = { operations: OperationCardData[]; isAdmin: boolean; hasFilter?: boolean };
```
- Empty state: se `hasFilter` → "Nenhuma Operação nesse status." (link limpar); senão admin/member copy atual.
- Grid: `grid grid-cols-1 2xl:grid-cols-2 gap-4`.

### `HomeSidebar` (novo, server) — `src/components/domain/HomeSidebar.tsx`

```ts
type Props = { isAdmin: boolean; topVillains: VillainFrequency[]; quickWinsLast30d: number };
```
- Card "Vilões da carteira" (admin) / "Vilões nas suas Operações" (member) com `HorizontalBarChart` (format count). Se `topVillains.length === 0` → empty state curto.
- `MetricCard` "Quick Wins (30d)" com `quickWinsLast30d`.
- Stack vertical `flex flex-col gap-6`. `sticky top-6` opcional (nice-to-have).

---

## Helpers

`src/lib/utils/status-filter.ts` (novo):
```ts
export type StatusFilter = "todas" | "em_construcao" | "em_operacao" | "janela_critica";
export function normalizeStatusFilter(raw: string | undefined): StatusFilter { ... }
```

Mantém `nameFromEmail`, `greeting`, `countByStatus` no page.tsx (ou move pra util se quiser; manter inline é ok).

---

## Reuso vs novo

| Item | Status |
|---|---|
| `MetricCard`, `HorizontalBarChart`, `FrentesAttentionSection`, `OperationCard` | reuso direto |
| `getDashboardSummary`, `getTopVillainsByFrequency`, `getActiveOperations`, `listFrentesNeedingAttention`, `countHotCriticalFrentes` | reuso (RLS-safe) |
| `HomeKpiStrip`, `HomeStatusTabs`, `OperationsGrid`, `HomeSidebar` | novos (composição) |
| `normalizeStatusFilter` | novo helper |
| `/admin/dashboard` | **inalterado** |

---

## Member-safety

- Faixa KPI: financeiro condicional a `isAdmin`. `summary.mrrTotal`/`monthlyMarginTotal` só renderizam pra admin (mesmo que a query calcule — RLS faz o número refletir só as ops do member, mas não exibimos).
- `getTopVillainsByFrequency` RLS-safe → member vê só vilões das ops dele.
- Nenhuma query admin-only disparada pra member.

---

## Riscos

- **R1 — `getDashboardSummary` pesa?** Faz ~7 queries + N queries de custo por op (`getOperationMonthlyCosts` por op ativa). Pra member com poucas ops, trivial. Pra admin, já roda hoje em /admin/dashboard sem problema. Aceitável.
- **R2 — `?status=` + RSC:** Link com searchParam re-renderiza server. `scroll={false}` evita pulo. OK.
- **R3 — Largura dos charts na sidebar:** `HorizontalBarChart` usa Recharts ResponsiveContainer? Confirmar que encolhe na coluna estreita. Se não, setar height fixa + width 100%.

---

## Plano de fases

PR único (`feat/home-dashboard`). Sem migration. Tarefas no tasks.md.
