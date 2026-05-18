# operation-costs Specification

## Problem Statement

Operação hoje tem MRR (receita) mas zero visibilidade de custo. Não dá pra calcular margem, decidir se cliente é rentável, comparar Operações ou priorizar. Conforme a operação cresce em equipe e ferramentas, custo invisível vira surpresa.

Pedido: gerir custos dentro da Operação com 3 fontes:
1. Custo fixo mensal (ex: hospedagem)
2. Custos ad-hoc com recorrência (ex: licença SaaS, freelancer)
3. Custos derivados de Alocações (capacidade × taxa horária da pessoa)

E calcular margem mensal: `MRR - custos mensais`.

## Goals

- [ ] Coluna `operations.monthly_fixed_cost numeric` (nullable, admin-only)
- [ ] Coluna `persons.hourly_rate numeric` (nullable, admin-only) — input em R$/hora
- [ ] Tabela nova `operation_costs` com FK CASCADE em operations
- [ ] Enum `cost_recurrence`: `mensal` | `unica`
- [ ] CRUD de `operation_costs` via Server Actions, admin-only (`requireAdminAction`)
- [ ] Query `getOperationMonthlyCosts(operationId)` retornando breakdown e total
- [ ] Tab nova **"Custos"** em `/operations/[id]`, visível só pra admin (esconde se member)
- [ ] OperationHero ganha card **"Margem"** ao lado de MRR (admin only); cor sage/warning/critical
- [ ] Painel admin (`/admin/dashboard`) ganha card **"Margem total"** (MRR total - custos totais mensais admin only)
- [ ] Form de edit pra `hourly_rate` no PersonForm (admin only)
- [ ] Form de edit pra `monthly_fixed_cost` no OperationForm (admin only)
- [ ] `/public/[token]` continua sem ver nada de custos
- [ ] DATABASE_SCHEMA.md atualizado

## Out of Scope

- **Audit log de mudança de custo** — `updated_at` cobre MVP
- **Custos com data retroativa computados** — sistema sempre olha o "hoje" pra cálculo mensal corrente
- **Conversão de moeda** — tudo em BRL fixo
- **Câmbio histórico**
- **Custos por Frente** — só Operação no MVP (Frente herda contexto)
- **Categorias de custo** (enum tools/people/infra) — label texto livre cobre
- **Hourly_rate diferente por papel ou nível** — só global por pessoa
- **Sobrescrever rate por allocation** — sempre usa rate global da pessoa
- **Sobrescrever rate por período** — sempre o atual; histórico não preservado
- **Total acumulado / lifetime** — só visão mensal corrente
- **Custos `unica` no cálculo de margem mensal** — entram em "custos totais" mas não na margem mensal
- **Projeção de margem futura** — só estado atual
- **Alocação sem rate** — conta como custo zero (não bloqueia)
- **Validação que custo não excede MRR** — permite margem negativa (sinaliza visual)
- **Multi-currency**
- **Custos em moeda do cliente (USD/EUR)** — todos em BRL
- **Botão "calcular sugestão de preço"** — fora

---

## User Stories

### P1: Schema ⭐ MVP

**Acceptance Criteria**:
1. Migration adiciona:
   - `operations.monthly_fixed_cost numeric(12,2)` nullable
   - `persons.hourly_rate numeric(10,2)` nullable
2. Enum `cost_recurrence` (`mensal`, `unica`)
3. Tabela `operation_costs`:
   - id uuid PK
   - operation_id FK CASCADE NOT NULL
   - label text NOT NULL CHECK length >= 2
   - amount numeric(12,2) NOT NULL CHECK >= 0
   - recurrence cost_recurrence NOT NULL DEFAULT 'mensal'
   - started_at date NOT NULL DEFAULT current_date
   - ended_at date NULL
   - notes text NULL
   - created_at, updated_at timestamptz
4. CHECK: `ended_at IS NULL OR ended_at >= started_at`
5. Index `(operation_id, recurrence)`
6. RLS `authenticated_full` (gate de admin via action)
7. Trigger updated_at

---

### P1: Server Actions ⭐ MVP

**Acceptance Criteria**:
1. `createOperationCostAction(operationId, formData)` — requireAdminAction
2. `updateOperationCostAction(id, formData)` — requireAdminAction
3. `deleteOperationCostAction(id)` — requireAdminAction
4. `updateOperationFixedCostAction(operationId, monthlyFixedCost)` — requireAdminAction
5. Validador Zod em `src/lib/validators/operationCost.ts`

---

### P1: Queries ⭐ MVP

**Acceptance Criteria**:
1. `listOperationCosts(operationId)` retorna lista ordenada por started_at desc
2. `getOperationMonthlyCosts(operationId)` retorna:
   ```
   {
     fixedCost: number,
     adHocMonthly: number,
     adHocOnceTotal: number,  // somatório de custos 'unica' (visão informativa)
     allocations: Array<{ personId, name, capacityPct, hourlyRate, monthly }>,
     allocationsTotal: number,
     totalMonthly: number,  // soma de fixed + adHocMonthly + allocationsTotal
   }
   ```
3. Cálculo allocations: `capacity_weekly_pct / 100 × hourly_rate × 4 × 40` (4 semanas × 40h/sem) — só pra alocações com `end_date IS NULL OR end_date > now()`
4. Alocações com person sem hourly_rate → contam zero (não bloqueiam)
5. Custos ad-hoc mensais: apenas com `recurrence='mensal'` E ativos (started_at <= now() AND (ended_at IS NULL OR ended_at >= now()))

### P1: Margem agregada ⭐ MVP

**Acceptance Criteria**:
1. Função `computeMargin(mrr, totalMonthlyCost)`:
   - Retorna `{ value, pct, level }` onde level é `positive`, `low` (≤10%), `negative`
2. Aplicada no OperationHero e Painel admin
3. Variant Pill: `sage` (positive), `warning` (low), `critical` (negative)

### P1: UI ⭐ MVP

**Acceptance Criteria**:
1. **Tab "Custos"** em `/operations/[id]`:
   - Aparece SÓ se `isAdmin` (não aparece pra member nem na URL direta acessível)
   - Section 1: Custo fixo mensal (input editável; salva via action)
   - Section 2: Lista de custos ad-hoc (label, amount, recurrence, datas, ações editar/deletar)
     - Botão "+ Adicionar custo"
   - Section 3: Tabela read-only de alocações ativas (Pessoa, Capacidade %, Rate R$/h, Custo mensal estimado)
     - Empty row se person.hourly_rate é null ("— sem taxa horária —")
   - Total mensal no topo: "Total custos/mês: R$ X.XXX,XX"
2. **OperationHero** ganha campo "Margem" admin-only:
   - Texto: "R$ X.XXX,XX (XX%)" + Pill variant
   - Esconde pra member
3. **OperationForm** ganha campo `monthly_fixed_cost` admin-only (input number BRL)
4. **PersonForm** ganha campo `hourly_rate` admin-only (input number BRL)
5. **Tab nav** filtrada server-side: array de tabs exclui "Custos" se `!isAdmin`

### P1: Painel admin ⭐ MVP

**Acceptance Criteria**:
1. DashboardSummary ganha:
   - `monthlyCostsTotal` (sum across operations ativas)
   - `monthlyMarginTotal` (mrrTotal - monthlyCostsTotal)
2. Painel renderiza novo card "Margem total" com value formatado + Pill variant pela `level`

### P2: Categorias de custo

Pulado. Label livre cobre.

### P3: Audit log

Pulado.

---

## Edge Cases

- **Operação sem fixed_cost** → considera 0
- **Operação sem alocações ativas** → allocationsTotal = 0
- **Person sem hourly_rate** → não bloqueia; conta 0 naquela alocação
- **Allocation com end_date passado** → não conta como ativa (não entra no cálculo)
- **Custo 'unica' com started_at no passado** → NÃO entra na margem mensal; aparece em "custos totais" se a UI quiser
- **Custo 'mensal' com ended_at no passado** → não conta como ativo
- **MRR null** → margem usa 0; sinaliza com hint "Sem MRR cadastrado"
- **Margem 0** → variant `low` (≤10%)
- **Cliente sem operação ativa** → não aparece no agregado do painel
- **Member tenta acessar `?tab=custos`** → tab inválida na lista do server → fallback `visao`
- **Action create/update/delete vinda de member via DevTools** → requireAdminAction → forbidden

---

## Success Criteria

- [ ] typecheck + build verdes
- [ ] Migration aplica; tipos regenerados
- [ ] Admin: tab "Custos" aparece em `/operations/[id]`
- [ ] Member: tab "Custos" NÃO aparece; URL `?tab=custos` cai em `visao`
- [ ] Admin pode editar `monthly_fixed_cost` no OperationForm
- [ ] Admin pode adicionar/editar/deletar custos ad-hoc
- [ ] Admin pode editar `hourly_rate` no PersonForm
- [ ] Tabela de alocações na tab Custos mostra pessoas alocadas e custo mensal
- [ ] OperationHero mostra Margem com cor correta (admin only)
- [ ] Painel admin mostra "Margem total"
- [ ] Member não vê Margem em lugar nenhum
- [ ] `/public/[token]` sem nenhuma menção de custo/margem
- [ ] DATABASE_SCHEMA.md atualizado (21 tabelas, novo enum)
- [ ] Smoke preview admin + (member se possível)

---

## Decisões de Domínio Pré-Design

| Questão | Decisão | Razão |
|---|---|---|
| 3 tipos de custo | Sim: fixed + ad-hoc + derivado de alocações | Pedido usuário |
| Visibilidade | Admin only | Inv. 14; info comercial sensível |
| Margem calc | MRR - custos mensais | Pedido usuário |
| Margem exibida | Hero + painel admin | Pedido usuário |
| Custos `unica` na margem mensal | NÃO | Margem mensal corrente; custo único é pontual |
| Hourly_rate por pessoa | Global, não por papel/allocation | Simplifica MVP |
| Allocation ativa | `end_date IS NULL OR > now()` | Cálculo só do que está em jogo |
| Person sem rate | Não bloqueia, conta 0 | Tolerância gradual |
| Tab nova "Custos" | Sim | Pedido usuário |
| Tab visível pra member | NÃO | Inv. 14 |
| Margem cores | sage/warning(≤10%)/critical(<0) | Sinal visual claro |
| Audit log | Não MVP | updated_at cobre |
| Conversão moeda | Não — BRL fixo | Escopo |
| Custo por Frente | Não MVP | Operação cobre |
| Multi-rate por pessoa | Não MVP | hourly_rate global |
| Custo de pessoa externa | Sim, se tiver rate | Mesma lógica |
| Public link | Nunca mostra custo/margem | Cliente externo nunca |
| Validação margem negativa | Permitido, sinaliza visual | Não bloqueia operação |
| Carga semanal pra cálculo | 40h × 4 semanas = 160h/mês | Padrão BR |
