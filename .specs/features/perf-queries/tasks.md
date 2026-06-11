# Perf de Queries — Tasks

**Design**: `.specs/features/perf-queries/design.md` · **Issue**: #131 · **Branch**: `feat/perf-queries`

Validação sem env local (padrão dos temas 1-2): row-set parity via SQL `EXCEPT` no MCP; runtime via preview Vercel (`delivery-os-git-feat-perf-queries-rafaelemeths-projects.vercel.app`); sintaxe PostgREST já validada (200 ×3).

---

## T1 — Migration: 5 índices FK quentes (D5) ✦ independente

- Criar `supabase/migrations/<ts>_hot_fk_indexes.sql` (5× `CREATE INDEX IF NOT EXISTS`, sem CONCURRENTLY).
- Aplicar via MCP `apply_migration`; `generate_typescript_types` (no-op esperado); atualizar `docs/DATABASE_SCHEMA.md` (tabela de migrations).
- **Verificação**: `get_advisors` performance — os 5 FKs saem de `unindexed_foreign_keys`; re-aplicar migration = no-op.

## T2 — `React.cache` em getUser/getProfile (D4) ✦ independente

- `src/lib/auth/server.ts`: `cache()` nas duas funções de leitura; `getProfile` delega ao `getUser` cacheado; `require*` intactos.
- **Verificação**: `tsc` limpo; nenhum call site quebra (grep import); preview: login + páginas autenticadas renderizam; role admin/member correto (Sidebar + op page no mesmo render).

## T3 — Core de custos multi-op + dashboard (D1) — depende de T2 (mesmo arquivo de page? não — independente, mas rodar tsc junto)

- `operation-costs.ts`: extrair `computeBreakdown` puro; fetch em `Promise.all`; single-op com filtro server-side `frente.operation_id` (SEM filtro archived de operação); novo `getActiveOperationsMonthlyCostsTotal` (itera sobre query de `operations`, rows default `[]`).
- `dashboard.ts`: trocar `.map(getOperationMonthlyCosts)` pela função nova.
- **Verificação**: SQL `EXCEPT` bidirecional via MCP — row-set novo (filtros server-side) vs row-set antigo (scan + filtro JS reproduzido em SQL) pra allocations e operation_costs, por op ativa = 0 rows; preview: KPI de custos/margem do dashboard idêntico ao prod atual; tab custos de 1 op com allocations idêntica.

## T4 — `listPublicTeam` scoped (D2) ✦ independente

- Embed `!inner` + `.eq("frente.operation_id")` + `.is("frente.archived_at", null)` + `.or(end_date...)`; guards JS mantidos.
- **Verificação**: SQL `EXCEPT` (conjunto de person_id antigo vs novo pra op do link real) = 0; preview público: mesma equipe renderizada.

## T5 — Waterfall público: `after()` + timing no batch (D3) — depende de T4 (mesmo arquivo public-report.ts)

- `page.tsx`: `after(() => touchPublicLinkAccess(link.id))` pós-resolve; `getReportContext`: timing no `Promise.all`.
- **Verificação**: preview: link válido → 200 e `last_accessed_at` atualiza (SQL antes/depois do curl); token inválido/expirado → 404 e `last_accessed_at` intacto.

## T6 — Op page: counts + 2 ondas + TabsNav (D6) — depende de T2 (getProfile no batch) e T3 (costsBreakdown condicional)

- 4 counts novos (`countMeetingsByOperation`, `countDecisionsByOperation`, `countOperationAttachments`, `countAreaTasksByOperation`) nos arquivos de domínio, padrão `head: true`.
- `operations/[id]/page.tsx`: onda 1 (profile, op, canCreateAreaTask, countAreaTasks) → normalizeTab → onda 2 (counts de shell + canWrite + tab ativa + custos se admin). Badges SEMPRE dos counts (exceto frentes via `op.frentes`).
- `TabsNav.tsx`: `prefetch={false}` + `TabPendingDot` via `useLinkStatus`.
- **Verificação**: `tsc`; preview por papel: admin — todas as 9 tabs renderizam com conteúdo atual, margin no hero em toda tab, badges = counts SQL; member — sem tab custos, zero queries de custos (sem margin); tab inválida na URL → visao; badge eventos = total real (documentado).

## T7 — Boundaries: error/not-found/loading (D7) — depende de T6 (TabsNav já com pending)

- `src/app/error.tsx` (root), `(app)/error.tsx`, `public/[token]/error.tsx` — todos `"use client"`, sem `error.message`.
- `src/app/not-found.tsx` (neutro DS), `public/[token]/not-found.tsx` (neutro público).
- `loading.tsx` só em `clients/[id]/` e `operations/[id]/frentes/[fid]/` — **antes de criar, grep `searchParams` no segmento+descendentes**; se ler, sai da lista.
- **Verificação**: build Vercel passa; preview: token inválido → 404 neutra pública; rota inexistente em (app) → 404 global; clique de tab → SEM skeleton full-page (dot pending no TabsNav); filtro em /clients?q= → sem flash.

## T8 — Docs + PR — depende de todos

- `docs/DATABASE_SCHEMA.md` (já em T1), `dryos-conventions/SKILL.md`: 3 convenções novas (badge = count `head:true`, regra de `loading.tsx` vs searchParams, `prefetch={false}` em tab-nav), STATE.md atualizado.
- Gate Implement: `/code-review` + validação runtime consolidada; PR com `Closes #131` listando docs alterados.
- **Verificação**: review sem finding aberto; tabela de validação no PR.

---

**Gate leve (auto-revisão)**: ✓ toda task tem critério executável; ✓ dependências explícitas (T3→T2 só por tsc conjunto — na real T3 é independente de T2, corrigido: dependência real é T6→{T2,T3} e T5→T4 e T7→T6); ✓ atômicas (cada uma = 1 commit lógico verificável). Ordem de execução: T1, T2, T3, T4 (paralelas em conceito) → T5 → T6 → T7 → T8.
