# link-publico-narrativa Tasks

**Design**: `.specs/features/link-publico-narrativa/design.md`
**Status**: Draft

---

## Execution Plan

```
Phase 1 — Foundation (sequential)
  T1 (migration) → T2 (regen types)

Phase 2 — Backend (parallel após T2)
  ├── T3 query villain-narratives
  ├── T4 server action narrativa
  ├── T5 helpers period + eta
  ├── T6 query QWs by period (refactor)
  ├── T7 query next moves
  ├── T8 query team
  └── T9 query agregadora getReportContext (depende de T3, T6, T7, T8)

Phase 3 — UI admin (após T4)
  ├── T10 VillainNarrativeForm
  └── T11 wire form em OperationVillainRow

Phase 4 — UI público (após T9)
  ├── T12 PublicReportBanner
  ├── T13 PublicReportHero
  ├── T14 refactor PublicVillainsList (narrativa)
  ├── T15 refactor PublicAchievementsList (header)
  ├── T16 PublicNextMovesList
  └── T17 PublicTeamGrid

Phase 5 — Integração (sequential)
  T18 (wire tudo em /public/[token]/page.tsx) → T19 (banner global acima das tabs)

Phase 6 — Validação (sequential)
  T20 (smoke E2E) → T21 (atualizar DATABASE_SCHEMA.md + STATE.md)
```

---

## Task Breakdown

### T1: Migration `operation_villain_narratives`

**What**: SQL migration criando tabela + UNIQUE + CHECK + RLS + trigger updated_at + COMMENT.
**Where**: `supabase/migrations/<timestamp>_operation_villain_narratives.sql`
**Depends on**: None
**Reuses**: Padrão das migrations existentes (DROP TRIGGER IF EXISTS + CREATE TRIGGER, ENABLE RLS, policy `authenticated_full`).

**Tools**: MCP Supabase (`apply_migration`).

**Done when**:
- [ ] Migration aplicada via MCP `apply_migration`
- [ ] `execute_sql` confirma: tabela existe, constraints existem, RLS enabled
- [ ] Insert válido passa; insert com `period_yyyymm='2026-13'` falha; insert duplicado falha; insert com narrative_text<20 chars falha
- [ ] `COMMENT ON TABLE` presente
- [ ] FK fk_ovn_operation_id ON DELETE CASCADE; fk_ovn_villain_id ON DELETE RESTRICT
- [ ] Index `idx_ovn_op_period` em `(operation_id, period_yyyymm)`

---

### T2: Regenerar types do banco

**What**: Rodar `npm run gen:types` (ou MCP `generate_typescript_types`) pra incluir nova tabela em `src/lib/db/types.ts`.
**Where**: `src/lib/db/types.ts` (regenerado)
**Depends on**: T1
**Reuses**: Script `gen:types` existente.

**Tools**: MCP Supabase (`generate_typescript_types`).

**Done when**:
- [ ] `src/lib/db/types.ts` tem `operation_villain_narratives` em `Tables`
- [ ] `npm run typecheck` passa

---

### T3: Query `villain-narratives` [P]

**What**: Funções `listVillainNarratives(operationId, period)` e `getVillainNarrative(operationVillainId, period)`.
**Where**: `src/lib/db/queries/villain-narratives.ts` (novo)
**Depends on**: T2
**Reuses**: `createServer`, `createAdmin`, padrão de queries existentes.

**Done when**:
- [ ] `listVillainNarratives` retorna `Record<villainId, string>` para uso público (usa `createAdmin`)
- [ ] `getVillainNarrative` retorna `{ text: string } | null` para uso admin (usa `createServer`)
- [ ] Filtra por `operation_id` + `period_yyyymm` exato
- [ ] `npm run typecheck` passa

---

### T4: Server action `upsertVillainNarrativeAction` [P]

**What**: Action que recebe `operationVillainId` + `FormData` com `narrative_text` + `period_yyyymm`, valida e faz upsert.
**Where**: `src/lib/actions/villain-narratives.ts` (novo)
**Depends on**: T2
**Reuses**: `ActionResult`, `err`, `ok`, `dbErr`, `requireUserAction`, padrão `allocations.ts`.

**Done when**:
- [ ] Guard `requireUserAction` na primeira linha (Inv. 14)
- [ ] Zod schema valida `narrative_text >= 20 chars trim` + `period_yyyymm` formato `YYYY-MM`
- [ ] Busca `operation_villain` pra extrair `operation_id` + `villain_id`
- [ ] Upsert via `.upsert({...}, { onConflict: 'operation_id,villain_id,period_yyyymm' })`
- [ ] `revalidatePath` em `/operations/[id]` (vai precisar do operationId)
- [ ] Retorna `ActionResult<{ id: string }>`
- [ ] `npm run typecheck` passa

---

### T5: Helpers `period.ts` + `eta.ts` [P]

**What**: Dois helpers puros para datas.
**Where**: `src/lib/utils/period.ts` + `src/lib/utils/eta.ts` (novos)
**Depends on**: None (independente do banco)
**Reuses**: Padrão dos helpers existentes em `src/lib/utils/`.

**Done when**:
- [ ] `getCurrentPeriod(now?)` retorna `{ yyyymm, year, month, monthLabel, monthLabelShort, prevYyyymm, prevMonthLabel }`
- [ ] `periodFromString('2026-05')` valida e retorna `Period | null`
- [ ] `operationMonthIndex(startDate, createdAt, now?)` retorna inteiro ≥ 1
- [ ] `formatEtaLabel(targetDate, now?)` retorna `"Hoje"`, `"Amanhã"`, dia da semana (`"Sex"`), ou `"DD/MM"` conforme distância
- [ ] Funções puras, sem dep externa além de `Date` nativo
- [ ] Pt-BR (Maio/Junho/etc) em strings
- [ ] `npm run typecheck` passa

---

### T6: Refactor `quick-wins.ts` — filtro por período [P]

**What**: Adicionar `listPublicQuickWinsByPeriod(operationId, yyyymm)` e `countQuickWinsByPeriod(operationId, yyyymm)`. Manter `listPublicQuickWins` existente.
**Where**: `src/lib/db/queries/quick-wins.ts` (modify)
**Depends on**: T2
**Reuses**: queries existentes do arquivo, `createAdmin`.

**Done when**:
- [ ] Filtro `happened_at >= <yyyymm>-01` e `< <yyyymm+1>-01` aplicado
- [ ] `countQuickWinsByPeriod` retorna `number`
- [ ] `listPublicQuickWinsByPeriod` retorna `QuickWinListItem[]` ordenado por `happened_at` desc
- [ ] `listPublicQuickWins` antigo continua funcionando (backwards compat)
- [ ] `npm run typecheck` passa

---

### T7: Query `listPublicNextMoves` [P]

**What**: Função agregadora retornando até N items (tasks + meetings futuras) ordenadas por data.
**Where**: `src/lib/db/queries/public-report.ts` (novo)
**Depends on**: T5 (precisa `formatEtaLabel`)
**Reuses**: `createAdmin`, schemas de `tasks` e `meetings`.

**Done when**:
- [ ] Query tasks: join Frentes da op → tasks com `due_date >= today` AND `status` ≠ `'done'`
- [ ] Query meetings: meetings da op com `meeting_at >= today` AND `visibility = 'cliente'`
- [ ] Merge + sort por data ASC + slice(0, limit)
- [ ] `etaLabel` pré-formatado via `formatEtaLabel`
- [ ] Default limit = 4
- [ ] `npm run typecheck` passa

---

### T8: Query `listPublicTeam` [P]

**What**: Retorna pessoas alocadas (alocações ativas) da Operação.
**Where**: `src/lib/db/queries/public-report.ts` (mesmo arquivo de T7)
**Depends on**: T2
**Reuses**: `createAdmin`, schema `allocations` + `persons`.

**Done when**:
- [ ] Alocações filtradas por `start_date <= today` AND (`end_date IS NULL` OR `end_date > today`)
- [ ] Join `persons` com `archived_at IS NULL`
- [ ] Dedup por `person_id` (uma pessoa em múltiplas frentes aparece 1 vez)
- [ ] `roleLabel` resolve: internal → `specialty`; external → `external_role`
- [ ] Retorna `TeamPerson[]`
- [ ] `npm run typecheck` passa

---

### T9: Agregador `getReportContext`

**What**: Função única que faz `Promise.all` de tudo que o relatório precisa e devolve struct pronta.
**Where**: `src/lib/db/queries/public-report.ts` (mesmo arquivo)
**Depends on**: T3, T6, T7, T8
**Reuses**: queries dos Tx anteriores; `listPublicVillains` existente; `getCurrentPeriod`.

**Done when**:
- [ ] Recebe `(operationId, period?: Period)`; default `getCurrentPeriod()`
- [ ] Promise.all: villains, narratives, qws current month, qw count current, qw count previous, next moves, team, op metadata (start_date/created_at)
- [ ] Retorna struct:
  ```ts
  {
    heroData: ReportHeroData,
    villains: OperationVillainListItem[],
    narrativesByVillainId: Record<string, string>,
    quickWins: QuickWinListItem[],
    quickWinsHeader: string,    // "Conquistas do mês · Maio · 4 quick wins"
    nextMoves: NextMoveItem[],
    team: TeamPerson[],
  }
  ```
- [ ] Calcula `heroData.topVillain` (maior progress_pct entre ativos)
- [ ] `monthIndex` via helper
- [ ] `npm run typecheck` passa

---

### T10: `VillainNarrativeForm` (componente)

**What**: Form client-component com textarea + zod validation + submit.
**Where**: `src/components/domain/VillainNarrativeForm.tsx` (novo)
**Depends on**: T4
**Reuses**: react-hook-form + zodResolver, `Button`, padrão de `AllocationForm.tsx`.

**Done when**:
- [ ] Props: `{ operationVillainId, villainName, period, existingText, onSuccess?: () => void }`
- [ ] Textarea com placeholder explicativo, contador de chars min 20
- [ ] Submit chama `upsertVillainNarrativeAction`
- [ ] Erro inline + erro geral
- [ ] Disabled durante submit
- [ ] `npm run typecheck` passa

---

### T11: Integrar form em `OperationVillainRow`

**What**: Botão "Narrativa do mês" no `OperationVillainRow` que abre modal/disclosure com `VillainNarrativeForm` pre-fetched.
**Where**: `src/components/domain/OperationVillainRow.tsx` (modify) + ajuste em `OperationVillainsSection.tsx` se necessário
**Depends on**: T10, T3 (pra pre-fetch)
**Reuses**: padrão de modal/disclosure existente; `getVillainNarrative`.

**Done when**:
- [ ] Botão "Narrativa do mês" oak link discreto
- [ ] Clicar abre form (inline disclosure ou modal — escolher o que já existe no codebase)
- [ ] Form vem pré-preenchido se existe narrativa pro mês corrente
- [ ] Após salvar OK, fecha form e refresh da página (router.refresh)
- [ ] `npm run typecheck` passa

---

### T12: `PublicReportBanner`

**What**: Componente fixo do topo com logo + título "Relatório de operação · `<Cliente>` · `<Mês Ano>`".
**Where**: `src/components/domain/PublicReportBanner.tsx` (novo)
**Depends on**: T5 (period label)
**Reuses**: tokens DS oak/cream, font display.

**Done when**:
- [ ] Server component
- [ ] Logo: quadrado oak 32px com "D" branca semibold
- [ ] "DRYOS" font display
- [ ] Title bar: `Relatório de operação · <client> · <month year>`
- [ ] Dark mode: fundo escuro, oak → sage
- [ ] `npm run typecheck` passa

---

### T13: `PublicReportHero`

**What**: Hero narrativo com headline + lede + stat lateral.
**Where**: `src/components/domain/PublicReportHero.tsx` (novo)
**Depends on**: T9 (consome `heroData`)
**Reuses**: `Pill`, tokens, lucide-react.

**Done when**:
- [ ] Recebe `ReportHeroData` (do design)
- [ ] Badge "Mês N de operação" com ícone raio
- [ ] Headline com vilão destacado ou fallback "jornada começou"
- [ ] Lede dinâmica
- [ ] Stat lateral: label, value grande, delta sub
- [ ] Delta null → "—"
- [ ] Dark mode coerente
- [ ] `npm run typecheck` passa

---

### T14: Refactor `PublicVillainsList` (narrativa) [P]

**What**: Adicionar prop opcional `narrativeByVillainId` e usar narrative_text quando disponível.
**Where**: `src/components/domain/PublicVillainsList.tsx` (modify)
**Depends on**: T9
**Reuses**: existing componente.

**Done when**:
- [ ] Prop opcional `narrativeByVillainId?: Record<string, string>`
- [ ] WHEN entrada existe → renderiza `narrative_text` no lugar de `villain.description`
- [ ] WHEN ausente → fallback comportamento atual
- [ ] Ordena por `progress_pct desc`
- [ ] `npm run typecheck` passa

---

### T15: Refactor `PublicAchievementsList` (header) [P]

**What**: Prop opcional `headerLabel` + empty state melhor.
**Where**: `src/components/domain/PublicAchievementsList.tsx` (modify)
**Depends on**: None (independente de T9)
**Reuses**: componente existente.

**Done when**:
- [ ] Prop `headerLabel?: string` default "Conquistas recentes"
- [ ] Prop `emptyStateText?: string` default mantém comportamento
- [ ] Caller passa "Conquistas do mês · `<Mês>` · `<N> quick wins`"
- [ ] Empty state copy: "Nenhuma conquista registrada em `<Mês>`."
- [ ] `npm run typecheck` passa

---

### T16: `PublicNextMovesList` [P]

**What**: Lista numerada 1-4 dos próximos movimentos.
**Where**: `src/components/domain/PublicNextMovesList.tsx` (novo)
**Depends on**: T9 (consome `nextMoves`)
**Reuses**: tokens DS.

**Done when**:
- [ ] Props: `{ items: NextMoveItem[] }`
- [ ] Renderiza só se items.length > 0
- [ ] Header "Próximos movimentos" + meta com mês corrente/seguinte
- [ ] Layout: número grande + texto + ETA à direita
- [ ] Dark mode coerente
- [ ] `npm run typecheck` passa

---

### T17: `PublicTeamGrid` [P]

**What**: Grid de cards do time alocado.
**Where**: `src/components/domain/PublicTeamGrid.tsx` (novo)
**Depends on**: T9 (consome `team`)
**Reuses**: `Avatar`, `getInitials`.

**Done when**:
- [ ] Props: `{ people: TeamPerson[] }`
- [ ] Renderiza só se people.length > 0
- [ ] Header "Quem cuida da sua operação" + count
- [ ] Cards: avatar + nome + role
- [ ] Grid responsivo (2-4 cols)
- [ ] Dark mode coerente
- [ ] `npm run typecheck` passa

---

### T18: Wire tudo em `/public/[token]/page.tsx`

**What**: Substituir conteúdo da aba "visao" pelos novos componentes; integrar `getReportContext`.
**Where**: `src/app/public/[token]/page.tsx` (modify)
**Depends on**: T9, T13, T14, T15, T16, T17
**Reuses**: estrutura atual (tabs, params).

**Done when**:
- [ ] `getReportContext(link.operationId)` chamado em paralelo com queries existentes
- [ ] Aba "visao" renderiza: `PublicReportHero` → `PublicVillainsList` (com narrativas) → `PublicAchievementsList` (com headerLabel do mês) → `PublicNextMovesList` → `PublicTeamGrid`
- [ ] Outras tabs intactas
- [ ] `npm run typecheck` passa

---

### T19: `PublicReportBanner` global acima das tabs

**What**: Renderizar banner antes do `TabsNav` no `/public/[token]/layout.tsx` (ou `page.tsx`).
**Where**: `src/app/public/[token]/layout.tsx` (modify) ou `page.tsx`
**Depends on**: T12, T9
**Reuses**: layout atual.

**Done when**:
- [ ] Banner aparece no topo de todas as tabs (Visão/Frentes/Reuniões/Anexos/SLA)
- [ ] `clientName` e `periodLabel` (mês corrente) passados como props
- [ ] `npm run typecheck` passa

---

### T20: Smoke E2E via Supabase + browser preview

**What**: Validação manual end-to-end.
**Where**: ambiente local + browser preview
**Depends on**: T18, T19
**Reuses**: `Claude_Preview` MCP.

**Done when**:
- [ ] Criar via SQL: narrativa de 2 vilões pro mês corrente; 3 QWs no mês corrente, 1 no anterior; 2 tasks + 1 meeting futuras; 3 alocações ativas
- [ ] Abrir `/public/[token]` no preview → ver 6 seções coerentes
- [ ] Hero mostra vilão de maior progresso + stat "3 · +2 vs `<mês anterior>`"
- [ ] Vilões com narrativa custom; um sem narrativa cai no fallback
- [ ] Próximos movimentos lista 3 items na ordem
- [ ] Time mostra 3 pessoas
- [ ] Toggle dark mode → fidelidade ao mockup
- [ ] Tabs antigas continuam funcionando

---

### T21: Atualizar `docs/DATABASE_SCHEMA.md` + STATE.md

**What**: Documentar nova tabela + registrar decisão no STATE.
**Where**: `docs/DATABASE_SCHEMA.md` + `.specs/project/STATE.md`
**Depends on**: T20
**Reuses**: estrutura existente dos docs.

**Done when**:
- [ ] `docs/DATABASE_SCHEMA.md` lista `operation_villain_narratives` na seção apropriada (módulo: public-report ou operation)
- [ ] Contagem total de tabelas atualizada
- [ ] Data "Última análise" atualizada (2026-05-18)
- [ ] `STATE.md` ganha entry "Current Work: link-publico-narrativa COMPLETE" e nova AD se houver decisão notável

---

## Parallel Execution Map

```
Phase 1 (sequential):
  T1 ──→ T2

Phase 2 (parallel após T2):
  T3 [P], T4 [P], T5 [P], T6 [P]

Phase 2.5 (após T5 + T2):
  T7 [P], T8 [P]

Phase 2.6 (após T3, T6, T7, T8):
  T9

Phase 3 (parallel após T4):
  T10 → T11 (sequencial entre si)

Phase 4 (parallel após T9):
  T12 [P], T13 [P], T14 [P], T15 [P], T16 [P], T17 [P]

Phase 5 (sequential):
  T18 → T19

Phase 6 (sequential):
  T20 → T21
```

---

## Tools per Task

| Task | MCP | Skill |
|---|---|---|
| T1 (migration) | Supabase `apply_migration` | `dryos-conventions` |
| T2 (regen types) | Supabase `generate_typescript_types` | — |
| T3-T9 (queries/actions) | — | `dryos-conventions` |
| T10-T17 (components) | — | `dryos-design-system` |
| T18-T19 (wire) | — | `dryos-design-system` |
| T20 (E2E) | `Claude_Preview`, Supabase `execute_sql` | — |
| T21 (docs) | — | — |
