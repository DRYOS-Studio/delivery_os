# operation-costs Design

**Spec**: `.specs/features/operation-costs/spec.md`

---

## Architecture Overview

1 migration adiciona 2 colunas (operations + persons), 1 enum, 1 tabela (`operation_costs`). Queries derivam custos mensais misturando: coluna `monthly_fixed_cost`, custos ad-hoc ativos `recurrence='mensal'`, allocations × hourly_rate × 160. Margin helper puro em utils. UI ganha tab "Custos" admin-only com 3 sections, Hero ganha card "Margem", painel admin ganha card "Margem total".

```mermaid
graph TD
    Mig[Migration] --> Ops[(operations + monthly_fixed_cost)]
    Mig --> Pers[(persons + hourly_rate)]
    Mig --> Costs[(operation_costs)]
    Page["/operations/[id]?tab=custos"] --> isAdmin{isAdmin?}
    isAdmin -- no --> Fallback["fallback visao"]
    isAdmin -- yes --> CostsTab[CostsTab]
    CostsTab --> CostsQuery[getOperationMonthlyCosts]
    CostsQuery --> Ops
    CostsQuery --> Costs
    CostsQuery --> Allocs[(allocations) -> persons.hourly_rate]
    Hero[OperationHero] -- isAdmin --> Margin[computeMargin]
    Dashboard["/admin/dashboard"] --> AggregateMargin[getDashboardSummary +margin]
```

---

## Code Reuse

| What | How |
|---|---|
| `formatMoneyBR` | display de R$ |
| `requireAdminAction`, `getProfile` | gating |
| `ActionResult<T>` helpers | actions |
| `Pill` variants | sage/warning/critical na margem |
| `MetricCard` | resumo no painel admin |
| `OperationHero` | adicionar card Margem |
| `OperationForm` | adicionar input fixed_cost |
| `PersonForm` | adicionar input hourly_rate |
| `TabsNav` | nav já filtra com server |

---

## Data Model

### Migration `<ts>_operation_costs.sql`

```sql
-- Colunas em existentes
ALTER TABLE public.operations
  ADD COLUMN IF NOT EXISTS monthly_fixed_cost numeric(12,2);

ALTER TABLE public.persons
  ADD COLUMN IF NOT EXISTS hourly_rate numeric(10,2);

-- Enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cost_recurrence') THEN
    CREATE TYPE cost_recurrence AS ENUM ('mensal', 'unica');
  END IF;
END $$;

-- Tabela
CREATE TABLE IF NOT EXISTS public.operation_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL,
  label text NOT NULL,
  amount numeric(12,2) NOT NULL,
  recurrence cost_recurrence NOT NULL DEFAULT 'mensal',
  started_at date NOT NULL DEFAULT current_date,
  ended_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_operation_costs_operation_id FOREIGN KEY (operation_id)
    REFERENCES public.operations(id) ON DELETE CASCADE,
  CONSTRAINT check_operation_costs_label CHECK (char_length(label) >= 2),
  CONSTRAINT check_operation_costs_amount CHECK (amount >= 0),
  CONSTRAINT check_operation_costs_dates CHECK (ended_at IS NULL OR ended_at >= started_at)
);

COMMENT ON TABLE public.operation_costs IS
  'operação: itens de custo manuais (mensal recorrente ou unica). Custo fixo principal vive em operations.monthly_fixed_cost. Custos derivados de pessoas vêm de allocations × persons.hourly_rate (não materializados). Admin-only via action layer.';
COMMENT ON COLUMN public.operations.monthly_fixed_cost IS 'Custo mensal fixo (BRL). Admin-only via UI; sem gate de RLS — gating no action.';
COMMENT ON COLUMN public.persons.hourly_rate IS 'Taxa horária (BRL/h). Admin-only via UI; usada no cálculo de custos derivados de allocations.';

CREATE INDEX IF NOT EXISTS idx_operation_costs_operation_recurrence
  ON public.operation_costs(operation_id, recurrence);

-- Trigger updated_at
DROP TRIGGER IF EXISTS set_operation_costs_updated_at ON public.operation_costs;
CREATE TRIGGER set_operation_costs_updated_at
  BEFORE UPDATE ON public.operation_costs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.operation_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operation_costs_authenticated_full ON public.operation_costs;
CREATE POLICY operation_costs_authenticated_full ON public.operation_costs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

RLS authenticated_full porque o gate verdadeiro é nas actions (Inv. 14, mesmo padrão de `tasks` etc).

---

## Validators

### `src/lib/validators/operationCost.ts` (novo)

```ts
export const operationCostSchema = z.object({
  label: z.string().trim().min(2, "Mínimo 2 caracteres.").max(150),
  amount: z.preprocess(
    (v) => (typeof v === "string" ? Number(v.replace(",", ".")) : v),
    z.number().nonnegative("Valor não pode ser negativo."),
  ),
  recurrence: z.enum(["mensal", "unica"]),
  started_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  ended_at: optionalDate,
  notes: optionalText(1000),
}).refine(
  (d) => !d.ended_at || d.ended_at >= d.started_at,
  { message: "Data de fim deve ser depois da data de início.", path: ["ended_at"] },
);
```

### Estender `validators/client.ts` ou `operation.ts`

Achar `operationSchema` em `validators/operation.ts` e adicionar `monthly_fixed_cost` opcional.
Estender `persons` validator com `hourly_rate` opcional.

---

## Queries — `src/lib/db/queries/operation-costs.ts` (novo)

```ts
export type OperationCostRow = {
  id: string;
  operationId: string;
  label: string;
  amount: number;
  recurrence: "mensal" | "unica";
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AllocationCost = {
  personId: string;
  personName: string;
  capacityPct: number;
  hourlyRate: number | null;
  monthlyCost: number; // 0 se hourlyRate null
};

export type OperationCostBreakdown = {
  fixedCost: number;
  adHocMonthly: number;       // soma de recurrence='mensal' ativos
  adHocOnceTotal: number;     // soma de 'unica' (informativo)
  adHocItems: OperationCostRow[];
  allocations: AllocationCost[];
  allocationsTotal: number;
  totalMonthly: number;       // fixedCost + adHocMonthly + allocationsTotal
};

export async function listOperationCosts(operationId): Promise<OperationCostRow[]>;
export async function getOperationCost(id): Promise<OperationCostRow | null>;
export async function getOperationMonthlyCosts(operationId): Promise<OperationCostBreakdown>;
```

**Implementação `getOperationMonthlyCosts`:**

```ts
// 1. Fetch operation.monthly_fixed_cost
const op = await supabase.from("operations").select("monthly_fixed_cost").eq("id", id).maybeSingle();
const fixedCost = op.data?.monthly_fixed_cost ?? 0;

// 2. Fetch operation_costs ativos
const today = new Date().toISOString().slice(0, 10);
const costs = await supabase.from("operation_costs")
  .select("*")
  .eq("operation_id", id)
  .lte("started_at", today)
  .or(`ended_at.is.null,ended_at.gte.${today}`);
const adHocItems = costs.data ?? [];
const adHocMonthly = adHocItems
  .filter(c => c.recurrence === "mensal")
  .reduce((s, c) => s + Number(c.amount), 0);
const adHocOnceTotal = adHocItems
  .filter(c => c.recurrence === "unica")
  .reduce((s, c) => s + Number(c.amount), 0);

// 3. Fetch allocations ativas via frentes
const allocs = await supabase.from("allocations")
  .select(`
    id, capacity_weekly_pct, end_date,
    person:persons!fk_allocations_person_id(id, name, hourly_rate, archived_at),
    frente:frentes!fk_allocations_frente_id(id, operation_id, archived_at)
  `)
  .or(`end_date.is.null,end_date.gt.${today}`);

const operationAllocs = allocs.data?.filter(a =>
  a.frente?.operation_id === id &&
  a.frente?.archived_at === null &&
  a.person?.archived_at === null
) ?? [];

const allocations: AllocationCost[] = operationAllocs.map(a => {
  const rate = a.person?.hourly_rate ? Number(a.person.hourly_rate) : null;
  const cap = Number(a.capacity_weekly_pct) / 100;
  const monthly = rate ? cap * rate * 160 : 0;
  return {
    personId: a.person!.id,
    personName: a.person!.name,
    capacityPct: Number(a.capacity_weekly_pct),
    hourlyRate: rate,
    monthlyCost: monthly,
  };
});
const allocationsTotal = allocations.reduce((s, x) => s + x.monthlyCost, 0);

return {
  fixedCost: Number(fixedCost),
  adHocMonthly, adHocOnceTotal,
  adHocItems: adHocItems.map(mapRow),
  allocations, allocationsTotal,
  totalMonthly: Number(fixedCost) + adHocMonthly + allocationsTotal,
};
```

**Para painel admin: `getDashboardSummary` estendido**

Adicionar `monthlyCostsTotal` e `monthlyMarginTotal` ao summary. Implementação: agregar todas Operações ativas. Cuidado com N+1 — fazer fetch em lote:

```ts
// Fetch todas operations ativas
const ops = await supabase.from("operations").select("id, monthly_recurring_revenue, monthly_fixed_cost").is("archived_at", null);
const fixedTotal = ops.data?.reduce((s, o) => s + Number(o.monthly_fixed_cost ?? 0), 0) ?? 0;

// Fetch todos ad-hoc mensais ativos das operações
const adHocAgg = await supabase.from("operation_costs").select("amount").eq("recurrence", "mensal").lte("started_at", today).or(...);
// Filter by operation_id IN active ops; cuidado: melhor join.

// Fetch todas allocations ativas com person hourly_rate
const allAllocs = await supabase.from("allocations").select(`
  capacity_weekly_pct, end_date,
  person:persons!fk_allocations_person_id(hourly_rate, archived_at),
  frente:frentes!fk_allocations_frente_id(operation_id, archived_at, operations!fk_frentes_operation_id(archived_at))
`).or(...);
// Filter ops ativas, frentes não-arquivadas, persons não-arquivadas; sum.
```

Aceitar simplificação: `monthlyCostsTotal` reusa loop sobre Operações ativas chamando `getOperationMonthlyCosts(opId).totalMonthly` — N+1, mas N pequeno (3 ops atualmente). Otimização pode vir depois.

**Decisão T-Implement:** loop por Operação (N+1 simples) até o número crescer.

---

## Margin Helper — `src/lib/utils/margin.ts` (novo)

```ts
export type MarginLevel = "positive" | "low" | "negative";

export type MarginResult = {
  value: number;        // BRL absoluto (mrr - cost)
  pct: number | null;   // percentual relativo a mrr; null se mrr=0
  level: MarginLevel;
};

export function computeMargin(
  mrr: number | null | undefined,
  monthlyCost: number,
): MarginResult {
  const m = mrr ?? 0;
  const value = m - monthlyCost;
  const pct = m > 0 ? (value / m) * 100 : null;
  let level: MarginLevel;
  if (value < 0) level = "negative";
  else if (pct !== null && pct <= 10) level = "low";
  else level = "positive";
  return { value, pct, level };
}

export function marginVariant(level: MarginLevel): PillVariant {
  return level === "positive" ? "sage" : level === "low" ? "warning" : "critical";
}
```

---

## Actions — `src/lib/actions/operationCosts.ts` (novo)

```ts
createOperationCostAction(operationId, formData) — requireAdminAction
updateOperationCostAction(id, formData) — requireAdminAction
deleteOperationCostAction(id) — requireAdminAction
```

E em `actions/operations.ts` (existente):
- Estender `updateOperationAction` pra aceitar `monthly_fixed_cost` (admin-only campo via condicional ou hidden)

E em `actions/persons.ts` (existente):
- Estender `updatePersonAction` pra aceitar `hourly_rate` (admin-only)

---

## Components

### `CostsTab.tsx` (novo, server)

```tsx
type Props = {
  operationId: string;
  fixedCost: number;
  breakdown: OperationCostBreakdown;
};
```

Render:
- Section "Custo fixo mensal" com input editável (form inline) ou Link "Editar Operação" pra reusar OperationForm
- Section "Custos ad-hoc" com lista + botão "+ Adicionar"
- Section "Custos de Alocações" (read-only tabela)
- Total no topo do card

### `CostListItem.tsx` (server) + `DeleteCostButton.tsx` (client)

Padrão de listagem com action.

### `CostForm.tsx` (client, RHF)

`new` / `edit` mode. Reuso de padrão existente.

### `OperationHero` (modificar)

Adicionar bloco "Margem" admin-only:
- Recebe `mrr`, `monthlyCost`, `isAdmin`
- Renderiza `<Pill variant={marginVariant(level)}>{formatMoneyBR(value)} ({pct}%)</Pill>` próximo ao MRR
- Se !isAdmin: esconde

### `OperationForm.tsx` (modificar)

Adicionar campo `monthly_fixed_cost` admin-only (similar ao MRR pattern). Member submete hidden input pra preservar valor.

### `PersonForm.tsx` (modificar)

Adicionar campo `hourly_rate` admin-only.

---

## Pages

### `/operations/[id]/page.tsx`

- Estender Promise.all com:
  - `getOperationMonthlyCosts(id)` (apenas se isAdmin pra economizar — ou sempre se barato)
- Decisão: sempre, pra simplificar. Custo é leve.
- Estender tabs array:
  - Adicionar `{ key: "custos", label: "Custos" }` **só se isAdmin**:
    ```ts
    const tabs = [
      ...,
      ...(isAdmin ? [{ key: "custos" as const, label: "Custos" }] : []),
      { key: "publico", label: "Acesso público" },
    ];
    ```
  - Normalizer aceita "custos" só se isAdmin; senão fallback `visao`
- Render condicional `tab === "custos"` → `<CostsTab ... />`
- Passar margem pro Hero

---

### `/admin/dashboard/page.tsx`

Adicionar card "Margem total" com `mrr - costsTotal` formatado e variant pela level.

---

## Error Handling

| Scenario | Action |
|---|---|
| Member acessa `?tab=custos` | Normalizer cai pra `visao` |
| Member tenta create cost via DevTools | requireAdminAction → forbidden |
| Amount negativo | CHECK no banco + Zod |
| ended_at < started_at | CHECK no banco + Zod refine |
| Person sem rate em alocação | Conta 0 (sem erro) |
| MRR null | Margem usa 0 como base; pct = null; level por value |
| Custo 'unica' com data futura | Não conta em mensal; aparece em adHocOnceTotal |
| Deletar custo | Hard delete (admin) |
| Allocation deletada | Não impacta — query reconsulta |

---

## Tech Decisions

| Decision | Choice | Rationale |
|---|---|---|
| 1 migration combinada | Sim | Atomic |
| RLS authenticated_full | Sim | Gate na action (Inv. 14) |
| Custo derivado materializado | Não | Recalcular é barato; sempre fresh |
| Hourly_rate global por pessoa | Sim | Sem override por allocation |
| Carga semanal padrão | 40h × 4 sem = 160h/mês | Padrão CLT brasileiro |
| Custo `unica` na margem mensal | Não | Margem é mensal corrente |
| Margem level threshold | ≤10% = warning | Heurística inicial |
| Margem com MRR=0 | level decidido por value; pct null | Edge case mas funcional |
| Tab "Custos" admin only | Server filtra tabs | Não vaza nem na nav |
| Painel admin agregado | Loop por Operação | N pequeno; otimizar quando ≥ 30 ops |
| Hard delete cost | Sim, admin | Sem histórico no MVP |
| Form pra fixed_cost | Reusa OperationForm com campo novo | Não criar form separado |
| Form pra hourly_rate | Reusa PersonForm com campo novo | Idem |
| Custos visíveis em /public | Nunca | Já garantido — public usa view dedicada |
| BRL | Hardcoded | Multi-currency v2 |
| Allocation com end_date null | Conta como ativa | |
| Allocation com end_date > now | Conta como ativa | Período corrente cobre |
| operation_costs index | (operation_id, recurrence) | Query mais comum |

---

## Notes

- Migration aplicada via MCP.
- Regenerar types após apply.
- `OperationCostBreakdown.adHocOnceTotal` é informativo (mostra na UI como "custos únicos no período" mas não soma em margem).
- Validação amount: aceitar tanto "1234.50" quanto "1234,50" (BRL friendly) no Zod preprocess.
- `monthly_fixed_cost` e `hourly_rate` sem CHECK no banco (aceitam negativo? evita pra MVP via Zod >= 0).
- DATABASE_SCHEMA.md: 22 tabelas (adiciona operation_costs); enum cost_recurrence novo.
- Performance: dashboard agregado pode levar N+1; aceito até N=10 Operações.
- `getDashboardSummary` retorno cresce com `monthlyCostsTotal` e `monthlyMarginTotal`; existing callers do dashboard precisam ajustar.
- Smoke: criar custo manual + verificar margin reativa; verificar member não vê tab.
