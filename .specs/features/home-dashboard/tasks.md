# Tasks: home-dashboard

**Spec:** [spec.md](./spec.md) · **Design:** [design.md](./design.md) · **Issue:** [#84](https://github.com/rafaelemeth/delivery_os/issues/84)

**Branch:** `feat/home-dashboard` · **PR:** `feat: home as 2-column dashboard (admin rich / member lean)` · body `Closes #84`

---

## T1 — Helper `normalizeStatusFilter`
- `src/lib/utils/status-filter.ts`: type `StatusFilter` + `normalizeStatusFilter(raw)`.
- Verificação: typecheck.

## T2 — `HomeKpiStrip` (server)
- `src/components/domain/HomeKpiStrip.tsx`. Props `{ summary, isAdmin }`.
- 4 cards sempre + 2 financeiros admin. Grid responsivo (6 cols admin / 4 member).
- Verificação: render.

## T3 — `HomeStatusTabs` (server)
- `src/components/domain/HomeStatusTabs.tsx`. Props `{ counts, active }`.
- Link tabs com `?status=` (scroll=false). Estilo ativo do page atual.
- Verificação: clicar troca o ativo.

## T4 — `OperationsGrid` (server)
- `src/components/domain/OperationsGrid.tsx`. Props `{ operations, isAdmin, hasFilter }`.
- Extrai cards + empty states do page atual. Grid `grid-cols-1 2xl:grid-cols-2`.
- Empty: filtro vs admin vs member.
- Verificação: render + empty states.

## T5 — `HomeSidebar` (server)
- `src/components/domain/HomeSidebar.tsx`. Props `{ isAdmin, topVillains, quickWinsLast30d }`.
- Card vilões (HorizontalBarChart format count_operations) + MetricCard QW 30d.
- Título muda admin ("carteira") vs member ("suas Operações").
- Verificação: render + empty quando sem vilões.

## T6 — Reescrever `page.tsx`
- Compõe tudo. Adiciona `searchParams: { status }`, `getDashboardSummary`, `getTopVillainsByFrequency` ao fetch.
- Layout grid 2 col. Filtro aplicado em `filteredOps`.
- Verificação: build + typecheck.

## T7 — Smoke + PR
- Build + typecheck verde, zero console error.
- Commit, push, `gh pr create` com `Closes #84`.
- Verificação manual Vercel: admin (6 KPIs + sidebar rica) vs member (4 KPIs + sidebar sem financeiro), filtro de tabs, responsivo.
- Atualizar STATE.md + ROADMAP (bônus).

---

## DoD
- [ ] Admin: faixa 6 KPIs + sidebar vilões/QW; member: 4 KPIs + sidebar vilões/QW
- [ ] Tabs filtram via ?status=
- [ ] Layout 2 col em xl, empilha abaixo
- [ ] Empty states preservados (filtro/admin/member)
- [ ] Build + typecheck verde
- [ ] STATE + ROADMAP atualizados
- [ ] #84 fechada no merge
