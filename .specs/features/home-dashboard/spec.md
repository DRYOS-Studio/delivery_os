# Feature: home-dashboard

**Issue:** [#84](https://github.com/rafaelemeth/delivery_os/issues/84)
**Status:** SPEC
**Created:** 2026-05-26

---

## Objetivo

Transformar a Home (`/`) de pilha vertical (saudação → tabs → Atenção → cards) num **dashboard em grid de 2 colunas**, role-aware: admin vê versão rica (com financeiro), member vê versão enxuta (sem números comerciais).

## Por que

A Home é a primeira tela pós-login. Hoje não dá leitura rápida do estado da carteira — só lista operações. Um dashboard com KPIs escaneáveis no topo + sinais operacionais (atenção) + contexto lateral (vilões, quick wins) faz a Home virar painel de comando. O `/admin/dashboard` já tem os blocos; falta compô-los na entrada.

## Personas

- **Admin (Gabriela, Rafael):** quer visão de carteira — receita, margem, saúde, vilões, tração.
- **Member (Gabriel):** quer visão operacional das **suas** ops — frentes paradas, tasks, vilões das ops dele. Sem MRR/margem/top-clientes.

## Layout

```
┌─────────────────────────────────────────────────────────┐
│ PageHeader (saudação + subtitle + "Nova operação" admin) │
├─────────────────────────────────────────────────────────┤
│ FAIXA KPI (full width) — MetricCards role-aware          │
│  admin:  Ops ativas | Frentes OK | Paradas | Tasks | MRR | Margem │
│  member: Ops ativas | Frentes OK | Paradas | Tasks       │
├──────────────────────────────────┬──────────────────────┤
│ COLUNA PRINCIPAL (xl: col-span-2)│ SIDEBAR (xl: col-span-1)│
│  - Status tabs (decorativas)     │  admin:               │
│  - FrentesAttentionSection       │   - Vilões da carteira │
│  - Grid de OperationCards        │   - Quick Wins 30d     │
│                                  │  member:              │
│                                  │   - Vilões das ops     │
│                                  │   - Quick Wins 30d     │
└──────────────────────────────────┴──────────────────────┘
```

Responsivo: `grid grid-cols-1 xl:grid-cols-3`. Em < xl empilha (sidebar vai pro fim). KPI strip: `grid-cols-2 md:grid-cols-4 xl:grid-cols-6` (admin) / `xl:grid-cols-4` (member).

## Requisitos funcionais

### RF1 — Faixa de KPIs
- Reusa `MetricCard`. Dados de `getDashboardSummary()` (já RLS-safe).
- Admin: `activeOperations`, `frentesHealthy`, `frentesStale` (variant warning se >0), `openTasks`, `mrrTotal` (money), `monthlyMarginTotal` (money, variant critical se <0).
- Member: os 4 primeiros, sem os 2 financeiros.

### RF2 — Coluna principal
- Mantém tabs decorativas de status (como hoje).
- `FrentesAttentionSection` (inalterado).
- Grid de `OperationCard` (inalterado), mas dentro da coluna (1-2 cols em vez de 3, por causa da largura menor).
- Empty state de operações segue o atual (admin vs member copy).

### RF3 — Sidebar
- Admin: `HorizontalBarChart` de vilões (de `getTopVillainsByFrequency`), `MetricCard` Quick Wins 30d.
- Member: mesmo, mas vilões filtrados pelas ops dele (RLS já cobre via `operation_villains`).
- Componente novo: `HomeSidebar` (server component) que recebe `isAdmin`, `topVillains`, `quickWinsLast30d`.

### RF4 — Role-awareness
- `getProfile()` → `isAdmin`. Tudo financeiro condicional.
- Member nunca dispara `getTopClientsByMRR` (admin-only).

### RF5 — Dados
- Admin: `getDashboardSummary`, `getTopVillainsByFrequency`, + ops/frentes atuais.
- Member: `getDashboardSummary` (RLS filtra), `getTopVillainsByFrequency` (RLS filtra), + ops/frentes.
- **Sem novas queries.** Tudo já existe e respeita RLS.

## Não-objetivos

- ❌ Mexer em `/admin/dashboard` (segue como deep-dive; possível consolidação futura é outra issue)
- ❌ Novas tabelas/migrations
- ❌ Tabs interativas (filtro real) — fica decorativo como hoje
- ❌ Sparkline/tendência temporal nova (sem série histórica de KPI ainda)
- ❌ Drag-and-drop / customização de widgets

## Critérios de aceite

- [ ] Admin: faixa KPI com 6 cards (inclui MRR + Margem) + sidebar com vilões + QW
- [ ] Member: faixa KPI com 4 cards (sem financeiro) + sidebar com vilões das ops dele + QW
- [ ] Layout 2 colunas em xl, empilha abaixo
- [ ] Atenção + cards de operação seguem funcionando
- [ ] Empty states preservados
- [ ] Build + typecheck verde, zero console error

## Decisões pra Design

- **D1:** Sidebar widget de vilões pra member faz sentido? (RLS filtra, mas member pode ver poucos.) → provável: manter, é leitura útil.
- **D2:** KPI strip: 6 cards numa linha (admin) fica apertado? Layout responsivo resolve, mas confirmar breakpoints.
- **D3:** Manter as tabs decorativas ou remover? (Hoje não filtram nada.) → decisão no design.
- **D4:** `OperationCard` grid dentro de coluna mais estreita: 1 col sempre, ou 2 em telas médias?
