import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type CostRecurrence = Database["public"]["Enums"]["cost_recurrence"];

export type OperationCostRow = {
  id: string;
  operationId: string;
  label: string;
  amount: number;
  recurrence: CostRecurrence;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AllocationCost = {
  allocationId: string;
  personId: string;
  personName: string;
  capacityPct: number;
  weeklyHours: number | null;
  effectiveWeeklyHours: number;
  hourlyRate: number | null;
  fixedMonthlyCost: number | null;
  monthlyCost: number;
};

export type OperationCostBreakdown = {
  fixedCost: number;
  adHocMonthly: number;
  adHocOnceTotal: number;
  adHocItems: OperationCostRow[];
  allocations: AllocationCost[];
  allocationsTotal: number;
  totalMonthly: number;
};

type RawCostRow = {
  id: string;
  operation_id: string;
  label: string;
  amount: number | string;
  recurrence: CostRecurrence;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function mapCost(r: RawCostRow): OperationCostRow {
  return {
    id: r.id,
    operationId: r.operation_id,
    label: r.label,
    amount: Number(r.amount),
    recurrence: r.recurrence,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function listOperationCosts(
  operationId: string,
): Promise<OperationCostRow[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("operation_costs")
    .select("*")
    .eq("operation_id", operationId)
    .order("started_at", { ascending: false });
  if (error) throw new Error(`listOperationCosts: ${error.message}`);
  return (data ?? []).map((r) => mapCost(r as RawCostRow));
}

export async function getOperationCost(
  id: string,
): Promise<OperationCostRow | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("operation_costs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getOperationCost: ${error.message}`);
  if (!data) return null;
  return mapCost(data as RawCostRow);
}

type PersonInJoin = {
  id: string;
  name: string;
  hourly_rate: number | string | null;
  monthly_compensation: number | string | null;
  contracted_weekly_hours: number | string | null;
  archived_at: string | null;
};

type FrenteInJoin = {
  id: string;
  operation_id: string;
  archived_at: string | null;
};

type AllocJoin = {
  id: string;
  capacity_weekly_pct: number | string;
  weekly_hours: number | string | null;
  monthly_cost: number | string | null;
  end_date: string | null;
  person: PersonInJoin | PersonInJoin[] | null;
  frente: FrenteInJoin | FrenteInJoin[] | null;
};

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

// Matemática do breakdown — função pura compartilhada pelo caminho single-op
// e pelo agregado do dashboard: paridade de KPI por construção. Os guards de
// frente/pessoa replicam os filtros server-side (defesa em profundidade contra
// regressão de embed, padrão do tema 2).
function computeBreakdown(
  operationId: string,
  fixedCost: number,
  adHocItems: OperationCostRow[],
  allocRows: AllocJoin[],
): OperationCostBreakdown {
  const adHocMonthly = adHocItems
    .filter((c) => c.recurrence === "mensal")
    .reduce((s, c) => s + c.amount, 0);
  const adHocOnceTotal = adHocItems
    .filter((c) => c.recurrence === "unica")
    .reduce((s, c) => s + c.amount, 0);

  const allocations: AllocationCost[] = [];
  for (const a of allocRows) {
    const frente = pickOne(a.frente);
    const person = pickOne(a.person);
    if (!frente || frente.operation_id !== operationId) continue;
    if (frente.archived_at !== null) continue;
    if (!person || person.archived_at !== null) continue;

    const compensation =
      person.monthly_compensation === null ||
      person.monthly_compensation === undefined
        ? null
        : Number(person.monthly_compensation);
    const contracted =
      person.contracted_weekly_hours === null ||
      person.contracted_weekly_hours === undefined
        ? null
        : Number(person.contracted_weekly_hours);
    const hourlyRateRaw =
      person.hourly_rate === null || person.hourly_rate === undefined
        ? null
        : Number(person.hourly_rate);

    const allocWeekly =
      a.weekly_hours === null || a.weekly_hours === undefined
        ? null
        : Number(a.weekly_hours);
    const fixedMonthly =
      a.monthly_cost === null || a.monthly_cost === undefined
        ? null
        : Number(a.monthly_cost);
    const capPct = Number(a.capacity_weekly_pct);

    let rate: number | null = null;
    if (compensation !== null && contracted !== null && contracted > 0) {
      rate = compensation / (contracted * 4);
    } else if (hourlyRateRaw !== null) {
      rate = hourlyRateRaw;
    }

    let effectiveWeekly: number;
    if (allocWeekly !== null) {
      effectiveWeekly = allocWeekly;
    } else if (contracted !== null && contracted > 0) {
      effectiveWeekly = (capPct / 100) * contracted;
    } else {
      effectiveWeekly = (capPct / 100) * 40;
    }

    const monthly =
      fixedMonthly !== null
        ? fixedMonthly
        : rate !== null
          ? rate * effectiveWeekly * 4
          : 0;

    allocations.push({
      allocationId: a.id,
      personId: person.id,
      personName: person.name,
      capacityPct: capPct,
      weeklyHours: allocWeekly,
      effectiveWeeklyHours: effectiveWeekly,
      hourlyRate: rate,
      fixedMonthlyCost: fixedMonthly,
      monthlyCost: monthly,
    });
  }
  const allocationsTotal = allocations.reduce((s, x) => s + x.monthlyCost, 0);

  return {
    fixedCost,
    adHocMonthly,
    adHocOnceTotal,
    adHocItems,
    allocations,
    allocationsTotal,
    totalMonthly: fixedCost + adHocMonthly + allocationsTotal,
  };
}

const ALLOC_SELECT_FIELDS = `
  id, capacity_weekly_pct, weekly_hours, monthly_cost, end_date,
  person:persons!fk_allocations_person_id(
    id, name, hourly_rate, monthly_compensation, contracted_weekly_hours, archived_at
  )
`;

export async function getOperationMonthlyCosts(
  operationId: string,
): Promise<OperationCostBreakdown> {
  const supabase = await createServer();
  const today = todayISO();

  // 3 queries paralelas, allocations filtradas pela operação NO SERVIDOR
  // (antes: seriais + scan da tabela inteira filtrado em JS).
  // Sem filtro de operação arquivada aqui: quem decide visibilidade é o caller
  // (op page já 404a arquivada) — preserva o comportamento atual.
  const [opRes, costsRes, allocRes] = await Promise.all([
    supabase
      .from("operations")
      .select("monthly_fixed_cost")
      .eq("id", operationId)
      .maybeSingle(),
    supabase
      .from("operation_costs")
      .select("*")
      .eq("operation_id", operationId)
      .lte("started_at", today)
      .or(`ended_at.is.null,ended_at.gte.${today}`)
      .order("started_at", { ascending: false }),
    supabase
      .from("allocations")
      .select(
        `${ALLOC_SELECT_FIELDS},
        frente:frentes!fk_allocations_frente_id!inner(id, operation_id, archived_at)`,
      )
      .eq("frente.operation_id", operationId)
      .is("frente.archived_at", null)
      .or(`end_date.is.null,end_date.gt.${today}`),
  ]);
  if (opRes.error)
    throw new Error(
      `getOperationMonthlyCosts.operation: ${opRes.error.message}`,
    );
  if (costsRes.error)
    throw new Error(
      `getOperationMonthlyCosts.costs: ${costsRes.error.message}`,
    );
  if (allocRes.error)
    throw new Error(
      `getOperationMonthlyCosts.allocations: ${allocRes.error.message}`,
    );

  const fixedCost = Number(opRes.data?.monthly_fixed_cost ?? 0);
  const adHocItems = (costsRes.data ?? []).map((r) =>
    mapCost(r as RawCostRow),
  );
  const allocRows = (allocRes.data ?? []) as unknown as AllocJoin[];

  return computeBreakdown(operationId, fixedCost, adHocItems, allocRows);
}

// Soma de custo mensal de TODAS as operações ativas em 3 queries fixas
// (independente de K) com payload constante — filtro de "operação ativa" via
// join embedado, nunca `.in(K uuids)`. Substitui o N+1 do dashboard
// (3 queries seriais × K operações; audit #9).
export async function getActiveOperationsMonthlyCostsTotal(): Promise<number> {
  const supabase = await createServer();
  const today = todayISO();

  const [opsRes, costsRes, allocRes] = await Promise.all([
    supabase
      .from("operations")
      .select("id, monthly_fixed_cost")
      .is("archived_at", null),
    supabase
      .from("operation_costs")
      .select(
        "*, operation:operations!fk_operation_costs_operation_id!inner(archived_at)",
      )
      .is("operation.archived_at", null)
      .lte("started_at", today)
      .or(`ended_at.is.null,ended_at.gte.${today}`),
    supabase
      .from("allocations")
      .select(
        `${ALLOC_SELECT_FIELDS},
        frente:frentes!fk_allocations_frente_id!inner(
          id, operation_id, archived_at,
          operation:operations!fk_frentes_operation_id!inner(archived_at)
        )`,
      )
      .is("frente.archived_at", null)
      .is("frente.operation.archived_at", null)
      .or(`end_date.is.null,end_date.gt.${today}`),
  ]);
  if (opsRes.error)
    throw new Error(
      `getActiveOperationsMonthlyCostsTotal.operations: ${opsRes.error.message}`,
    );
  if (costsRes.error)
    throw new Error(
      `getActiveOperationsMonthlyCostsTotal.costs: ${costsRes.error.message}`,
    );
  if (allocRes.error)
    throw new Error(
      `getActiveOperationsMonthlyCostsTotal.allocations: ${allocRes.error.message}`,
    );

  const costsByOp = new Map<string, OperationCostRow[]>();
  for (const r of costsRes.data ?? []) {
    const cost = mapCost(r as RawCostRow);
    const list = costsByOp.get(cost.operationId) ?? [];
    list.push(cost);
    costsByOp.set(cost.operationId, list);
  }

  const allocsByOp = new Map<string, AllocJoin[]>();
  for (const raw of (allocRes.data ?? []) as unknown as AllocJoin[]) {
    const frente = pickOne(raw.frente);
    if (!frente) continue;
    const list = allocsByOp.get(frente.operation_id) ?? [];
    list.push(raw);
    allocsByOp.set(frente.operation_id, list);
  }

  // Itera sobre o resultado de `operations` (não sobre as rows agrupadas):
  // op ativa sem costs/allocations contribui com o monthly_fixed_cost.
  let total = 0;
  for (const op of opsRes.data ?? []) {
    const breakdown = computeBreakdown(
      op.id,
      Number(op.monthly_fixed_cost ?? 0),
      costsByOp.get(op.id) ?? [],
      allocsByOp.get(op.id) ?? [],
    );
    total += breakdown.totalMonthly;
  }
  return total;
}
