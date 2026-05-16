# operations-crud Tasks

**Design**: `.specs/features/operations-crud/design.md`
**Status**: Draft

---

## Execution Plan

```
Phase 1 — Deps + foundations:
  T1 (npm install react-hook-form + resolvers + recharts)
  T2 (operationSchema Zod)
  T3 (money utils)
  T4 (date utils refactor — extract formatDateBR)

Phase 2 — Queries + actions:
  T5 (queries/operations.ts — list/get/count/hasFrentes)
  T6 (actions/operations.ts — create/update/archive)

Phase 3 — Components (paralelo):
  T7 (OperationsTable)
  T8 (OperationsSearch)
  T9 (Sparkline — Recharts client)
  T10 (FinanceCards)
  T11 (FrentesListSection)
  T12 (PlaceholderSection genérico)
  T13 (OperationHero + MetaChip interno)
  T14 (OperationForm com RHF — new pattern)
  T15 (refactor ClientForm → RHF)

Phase 4 — Pages:
  T16 (/operations/page.tsx)
  T17 (/operations/new/page.tsx)
  T18 (/operations/[id]/page.tsx — substitui placeholder)
  T19 (/operations/[id]/edit/page.tsx)

Phase 5 — Sidebar + Home:
  T20 (Sidebar + SidebarNav update — count + Briefcase icon)
  T21 (Home page.tsx — botão "+ Nova operação")

Phase 6 — Docs + validate + ship:
  T22 (docs/DATABASE_SCHEMA.md — primeiro fill)
  T23 (typecheck + build + screenshots)
  T24 (issue + commit + push + PR)
```

Caminho crítico: T1 → T2 → T6 → T14 → T17/T19 → T23 → T24.

---

## Task Breakdown

### T1: `npm install react-hook-form @hookform/resolvers recharts`

**Done when**: 3 deps em `package.json`; typecheck passa.

---

### T2: `src/lib/validators/operation.ts` — Zod schema

**Done when**:
- [ ] `operationSchema` com client_id (uuid), product_line (enum), name (min 1), status (enum sem 'arquivada'), recurrence (enum opcional), monthly_recurring_revenue (number opcional), start_date/end_date (string date opcional)
- [ ] `.refine` cross-field: end_date ≥ start_date
- [ ] Mensagens pt-BR
- [ ] `type OperationInput = z.infer<typeof operationSchema>`

---

### T3: `src/lib/utils/money.ts`

**Done when**:
- [ ] `formatMoneyBR(value: number | null): string` — "R$ 8.500,00" ou "—"
- [ ] `parseMoneyBR(input: string): number | null` — aceita variações; null se vazio
- [ ] Casos teste mentais: "8500" → 8500, "8.500,00" → 8500, "R$ 1.234,56" → 1234.56, "" → null

---

### T4: `src/lib/utils/date.ts` — extract formatDateBR

**Done when**:
- [ ] Exporta `formatDateBR(iso: string | null): string` — DD/MM/YYYY ou "—" se null
- [ ] OperationCard, ClientsTable, ClientDetail page usam o helper
- [ ] Helpers locais removidos dos arquivos antigos

---

### T5: `src/lib/db/queries/operations.ts` — extend

**Done when**:
- [ ] `type OperationListItem` exportado
- [ ] `type OperationDetail` exportado
- [ ] `listOperations({ search? })` com embed `client:clients(name, slug)` + `frentes(id, archived_at)` (pra contagem); filtra `archived_at IS NULL`; busca via `or(name.ilike, clients.name.ilike)` (pode precisar de RPC se PostgREST não suportar diretamente — fallback: filtrar no app após fetch se a query complex falhar)
- [ ] `getOperation(id)`: returns null se 404/arquivada; embed `client(*)` + `frentes(*, allocations(id))`
- [ ] `countActiveOperations(): Promise<number>`
- [ ] `operationHasActiveFrentes(id): Promise<boolean>`

**Edge**: PostgREST `or` com nested filter pode não funcionar diretamente em `clients.name`. Workaround: 2 queries paralelas (ops por name OR ops por client com nome match) e merge; ou filtrar client_id em separado. Implementar simples primeiro, otimizar se necessário.

---

### T6: `src/lib/actions/operations.ts` — 3 actions

**Done when**:
- [ ] `createOperationAction(formData)`: guard auth → parse Zod → INSERT → ok({id, name}); 23503 (FK violation) → invalid_client
- [ ] `updateOperationAction(id, formData)`: ignora client_id mudança (sempre usa o atual); parse Zod sem client_id; update; ok({id})
- [ ] `archiveOperationAction(id)`: checa hasActiveFrentes → bloqueia ou archive

---

### T7: `OperationsTable.tsx` (server) [P]

**Done when**: tabela renderiza `OperationListItem[]` com 8 colunas conforme spec; empty state varia por hasSearch.

---

### T8: `OperationsSearch.tsx` (client) [P]

**Done when**: clone de ClientsSearch com placeholder "Buscar por operação ou cliente…" e endpoint `/operations`.

---

### T9: `Sparkline.tsx` (client) [P]

**Done when**:
- [ ] `'use client'`
- [ ] Recebe `data: number[]`
- [ ] `<ResponsiveContainer width="100%" height={40}>` com `<AreaChart>` minimal: Area dataKey="value", stroke sage, fill gradient sage→transparent
- [ ] Sem axes, sem tooltip, sem grid — só a área
- [ ] Helper `mockMrrHistory(currentMrr: number, seed: string): number[]` retorna 6 pontos com variação ±10% determinística por `seed`

---

### T10: `FinanceCards.tsx` (server) [P]

**Done when**: 3 cards: MRR (+ Sparkline), Recorrência, Contrato. Usa formatMoneyBR. Empty value handling.

---

### T11: `FrentesListSection.tsx` (server) [P]

**Done when**: h2 + Pill com contagem; lista rows compactas: nome + Pill ciclo + Pill domínio + status acionável truncado (max 80 chars). Empty: "Nenhuma Frente nesta Operação."

---

### T12: `PlaceholderSection.tsx` (server) [P]

**Done when**: Props `{ title, subtitle, comingIn }`; renderiza Card simples com h2 + texto + Pill warning com "Em construção · {comingIn}".

---

### T13: `OperationHero.tsx` (server)

**Done when**:
- [ ] Bloco oak com gradient sage absolute
- [ ] Breadcrumb mono uppercase
- [ ] Pill linha (sage variant) + Pill status (override com className pra dark bg — `bg-white/15 text-bg/80`)
- [ ] Nome cliente em Funnel Display 2.5rem font-semibold
- [ ] Nome operação em Onest 16 opacity 0.7
- [ ] MetaChip interno × 5 (Recorrência, MRR, Início, Fim, Criado)
- [ ] Button "Editar" no canto direito (ghost com override pra contrast)

---

### T14: `OperationForm.tsx` (client) — RHF pattern

**Done when**:
- [ ] `'use client'`
- [ ] `useForm({ resolver: zodResolver(operationSchema), defaultValues: ... })`
- [ ] `mode = 'create' | 'edit'` discriminated union
- [ ] Props: `clientsForSelect: { id, name }[]` (preload server-side)
- [ ] Inputs com `register('client_id')`, etc; `errors.client_id?.message` per field
- [ ] Auto-suggest do nome via `watch('client_id') + watch('product_line')` + setValue('name', ...) se nameTouched=false
- [ ] Submit: `handleSubmit(async (data) => { ... })` — chama action; map server errors pra `setError('field', { message })`
- [ ] useTransition pro feedback de loading
- [ ] Botões: Salvar (primary), Cancelar (ghost link), Arquivar (ghost critical, só em edit + canArchive)

---

### T15: Refatorar `ClientForm.tsx` → RHF

**Done when**:
- [ ] Migra de `useState/useTransition` pra `useForm` + `zodResolver(clientSchema)`
- [ ] Mesma UX/funcionalidade preservada
- [ ] Erros server mapped via `setError('slug', ...)` em vez de state local
- [ ] Funciona idêntico no smoke test

---

### T16: `/operations/page.tsx` (server)

**Done when**: igual a /clients/page.tsx; PageHeader + Search + Table; Promise.all([listOperations, countActiveOperations]).

---

### T17: `/operations/new/page.tsx`

**Done when**:
- [ ] Preload `const clients = await listClients()` (clients pro select)
- [ ] Empty state se 0 clientes: "Crie um Cliente primeiro" + link
- [ ] `<OperationForm mode="create" clientsForSelect={clients} />`

---

### T18: `/operations/[id]/page.tsx` — DETAIL COMPLETO

**Done when**:
- [ ] params async; UUID validation; getOperation; notFound se null
- [ ] `<OperationHero op={op} client={op.client} />`
- [ ] `<PlaceholderSection title="Vilões em luta" comingIn="sem 04" />`
- [ ] `<FrentesListSection frentes={op.frentes} />`
- [ ] `<PlaceholderSection title="Briefing vivo" comingIn="sem 03" />`
- [ ] `<PlaceholderSection title="Reuniões e decisões" comingIn="sem 03" />`
- [ ] `<FinanceCards op={op} />`
- [ ] `<PlaceholderSection title="Credenciais" comingIn="v2 — AD-009" />`

---

### T19: `/operations/[id]/edit/page.tsx`

**Done when**:
- [ ] getOperation; redirect /operations se null
- [ ] operationHasActiveFrentes pra canArchive
- [ ] listClients pro select (apesar de client_id disabled)
- [ ] `<OperationForm mode="edit" initialData={op} clientsForSelect={clients} canArchive={!hasFrentes} />`

---

### T20: Sidebar + SidebarNav update

**Done when**:
- [ ] Sidebar.tsx: `Promise.all` de getUser + countActiveClients + countActiveOperations
- [ ] SidebarNav.tsx: nova prop `operationsCount`; novo NavItem com icon `Briefcase`
- [ ] Active state: `/operations` OU `/operations/*`

---

### T21: Home page.tsx — botão "+ Nova operação"

**Done when**: PageHeader actions tem o Link + Button sage; alinhado à direita.

---

### T22: `docs/DATABASE_SCHEMA.md` — primeiro fill

**Done when**:
- [ ] Arquivo criado com header + índice por módulo
- [ ] Lista 5 tabelas atuais (clients, persons, operations, frentes, allocations) com 1 linha cada
- [ ] Seção "Próximas tabelas planejadas" mencionando villains, quick_wins, briefings, meetings, decisions, attachments, notifications, profiles, sla
- [ ] "Última análise: 2026-05-16"

---

### T23: Build + smoke + screenshots

**Done when**:
- [ ] `npm run typecheck` + `build` verdes
- [ ] Local dev: visitar /operations → 3 linhas; criar nova → aparece; detalhe mostra hero + sections + frente de Acme; editar OK
- [ ] Screenshots: list, new, detail (Acme Core), edit

---

### T24: Issue + commit + push + PR

**Done when**: issue criada; branch `feat/operations-crud` from origin/main; 1 commit cohesivo; PR aberto com Closes #N + test plan.

---

## Pre-Implementation Confirmation

Pace: reto T1→T23, pauso antes do T24/PR pra você revisar screenshots. ~60min de fluxo (feature maior que clients-crud por causa do detail rico). OK?
