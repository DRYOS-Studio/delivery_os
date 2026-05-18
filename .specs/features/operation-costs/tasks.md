# operation-costs Tasks

**Design**: `.specs/features/operation-costs/design.md`

---

## Execution Plan

```
Phase 1 — Schema:
  T1 (migration: 2 ADD COLUMN + enum + tabela + index + trigger + RLS)
  T2 (regenerate types)

Phase 2 — Domain:
  T3 (validators/operationCost.ts + estender operation + person validators)
  T4 (queries/operation-costs.ts: list, get, getMonthlyCosts breakdown)
  T5 (actions/operationCosts.ts: CRUD admin-only)
  T6 (estender actions/operations.ts e actions/persons.ts pra novos campos)
  T7 (utils/margin.ts: computeMargin + marginVariant)

Phase 3 — UI components:
  T8 (CostForm + CostListItem + DeleteCostButton)
  T9 (CostsTab section composição)
  T10 (OperationHero + Margem block admin only)
  T11 (OperationForm + monthly_fixed_cost field)
  T12 (PersonForm + hourly_rate field)

Phase 4 — Pages:
  T13 (/operations/[id]/page.tsx: tab condicional, Promise.all extendido)
  T14 (/admin/dashboard: card Margem total + summary extendido)

Phase 5 — Ship:
  T15 (DATABASE_SCHEMA.md)
  T16 (build + smoke preview admin)
  T17 (commit + PR + merge)
```

Caminho crítico: T1→T2→T4→T7→T9→T13→T16→T17. Paralelo: T3↔T5↔T6, T8↔T9, T10↔T11↔T12. ~120-150min.

---

## Task Breakdown

### T1: Migration `<ts>_operation_costs.sql`

- [ ] ALTER TABLE operations ADD COLUMN monthly_fixed_cost numeric(12,2)
- [ ] ALTER TABLE persons ADD COLUMN hourly_rate numeric(10,2)
- [ ] CREATE TYPE cost_recurrence (mensal/unica) idempotente
- [ ] CREATE TABLE operation_costs com FKs, CHECKs, COMMENT
- [ ] Index (operation_id, recurrence)
- [ ] Trigger updated_at
- [ ] RLS authenticated_full
- [ ] Aplicado via MCP

### T2: Regenerate types

- [ ] `npm run gen:types`

### T3: Validators

- [ ] Criar `src/lib/validators/operationCost.ts`
- [ ] Estender `validators/operation.ts` com monthly_fixed_cost opcional
- [ ] Estender validador de persons com hourly_rate opcional

### T4: Queries operation-costs

- [ ] `listOperationCosts(operationId)` ordem started_at desc
- [ ] `getOperationCost(id)`
- [ ] `getOperationMonthlyCosts(operationId)`:
  - Fetch op.monthly_fixed_cost
  - Fetch operation_costs ativos
  - Fetch allocations ativas com person.hourly_rate
  - Computa breakdown completo
  - Reuso de pattern (filter by today)

### T5: Actions operationCosts

- [ ] `createOperationCostAction(operationId, formData)`
- [ ] `updateOperationCostAction(id, formData)`
- [ ] `deleteOperationCostAction(id)`
- [ ] Todos com `requireAdminAction` + Zod + revalidatePath

### T6: Estender actions existentes

- [ ] `updateOperationAction`: aceita `monthly_fixed_cost` no payload
- [ ] `updatePersonAction`: aceita `hourly_rate` no payload
- [ ] Ambos preservam valor existente se field não vier (member não muda)

### T7: utils/margin.ts

- [ ] `computeMargin(mrr, monthlyCost)` retornando MarginResult
- [ ] `marginVariant(level)` → PillVariant
- [ ] Threshold ≤10% = low

### T8: Cost UI atoms

- [ ] `CostForm.tsx` client RHF
- [ ] `CostListItem.tsx` server
- [ ] `DeleteCostButton.tsx` client window.confirm + action

### T9: CostsTab

- [ ] `CostsTab.tsx` server
- [ ] Props: operationId, fixedCost, breakdown
- [ ] 3 sections (fixed, ad-hoc, alocações) + total no topo
- [ ] Botão "+ Adicionar custo" linka pra `tasks/new` (criar rota?) — alternativa: form inline ou modal
  - Decisão: rota nova `/operations/[id]/costs/new` e `/operations/[id]/costs/[cid]/edit`
- [ ] Tabela read-only de allocations com Pessoa | Cap% | Rate | Mensal

### T10: OperationHero + Margem

- [ ] Adicionar prop `margin: MarginResult | null` (null se !isAdmin)
- [ ] Renderizar bloco "Margem" condicional ao lado/abaixo do MRR
- [ ] Variant Pill via marginVariant

### T11: OperationForm fixed_cost

- [ ] Adicionar `Field` "Custo fixo mensal" admin-only
- [ ] Member: hidden input preservando valor
- [ ] Validação Zod >= 0
- [ ] Cuidar do estado inicial via formatMoneyBR

### T12: PersonForm hourly_rate

- [ ] Adicionar `Field` "Taxa horária (R$/h)" admin-only
- [ ] Member: hidden input preservando valor
- [ ] Validação Zod >= 0

### T13: Operation detail page

- [ ] Estender Promise.all com `getOperationMonthlyCosts(id)` (sempre, mesmo non-admin pra simplicidade)
- [ ] Estender tabs array conditional: append "custos" se isAdmin
- [ ] Normalizer: aceitar "custos" só se isAdmin
- [ ] Render condicional `tab === "custos" && <CostsTab ... />`
- [ ] Passar margem pro OperationHero

### T14: Painel admin

- [ ] Estender `getDashboardSummary` com `monthlyCostsTotal` e `monthlyMarginTotal`
- [ ] Implementação: loop sobre Ops ativas chamando `getOperationMonthlyCosts(opId).totalMonthly` (N+1 aceitável MVP)
- [ ] Renderizar card "Margem total" no DashboardCountsGrid ou MRRSection (avaliar layout)
- [ ] Variant via marginVariant

### T15: DATABASE_SCHEMA.md

- [ ] Adicionar `operation_costs` (22ª tabela)
- [ ] Adicionar enum `cost_recurrence`
- [ ] Marcar colunas novas em operations e persons
- [ ] Migration list + última análise

### T16: Build + smoke

- [ ] `npm run build`
- [ ] Smoke admin:
  - Editar Pessoa → adicionar hourly_rate 200
  - Editar Operação → adicionar monthly_fixed_cost 1000
  - `/operations/[id]?tab=custos` aparece pra admin; renderiza 3 sections
  - Adicionar custo ad-hoc R$ 500 mensal → total atualiza
  - Tabela alocações mostra pessoa × 40% × R$ 200/h × 160 = R$ 12.800
  - OperationHero mostra Margem R$ ... admin only
- [ ] Smoke como member (se possível):
  - Tab "Custos" não aparece na nav
  - `?tab=custos` URL direta → fallback `visao`
  - Hero sem Margem

### T17: Commit + PR + merge

- [ ] commit imperativo
- [ ] gh pr create com Closes #60

---

## Pre-Impl

Pace: reto T1→T16, pauso antes do PR. ~120-150min.

**Riscos:**
- T4 join pra allocations: shape do Supabase com `frente:frentes!fk_allocations_frente_id(...)` pode retornar array. Cast manual ou type guard.
- T9 botão "Adicionar custo" + rotas novas: precisa criar `/operations/[id]/costs/new` e `[cid]/edit`. Atenção pra não conflitar com tab `?tab=custos` — rotas são sub-rotas /operations/[id]/costs/*.
- T11/T12 hidden input preservando valor: olhar como OperationForm faz hoje pra MRR/recurrence (já existe esse pattern em profiles feature) e replicar.
- T13 tabs array tipado: append condicional pode complicar TypeScript const assertions. Pode precisar de cast explicit.
- T14 N+1 no painel admin: aceitar; mas se rodar lento, batch fetch.
- T6 actions existentes: novos campos sem default null podem quebrar inserts pré-existentes? Validar — todos novos campos são nullable.
- T16 smoke: cuidado com viewport do preview screenshot (já passou antes).
