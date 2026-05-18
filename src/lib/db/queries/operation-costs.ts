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
  hourlyRate: number | null;
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

type AllocJoin = {
  id: string;
  capacity_weekly_pct: number | string;
  end_date: string | null;
  person:
    | {
        id: string;
        name: string;
        hourly_rate: number | string | null;
        archived_at: string | null;
      }
    | Array<{
        id: string;
        name: string;
        hourly_rate: number | string | null;
        archived_at: string | null;
      }>
    | null;
  frente:
    | { id: string; operation_id: string; archived_at: string | null }
    | Array<{ id: string; operation_id: string; archived_at: string | null }>
    | null;
};

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function getOperationMonthlyCosts(
  operationId: string,
): Promise<OperationCostBreakdown> {
  const supabase = await createServer();
  const today = todayISO();

  const opRes = await supabase
    .from("operations")
    .select("monthly_fixed_cost")
    .eq("id", operationId)
    .maybeSingle();
  if (opRes.error)
    throw new Error(
      `getOperationMonthlyCosts.operation: ${opRes.error.message}`,
    );
  const fixedCost = Number(opRes.data?.monthly_fixed_cost ?? 0);

  const costsRes = await supabase
    .from("operation_costs")
    .select("*")
    .eq("operation_id", operationId)
    .lte("started_at", today)
    .or(`ended_at.is.null,ended_at.gte.${today}`)
    .order("started_at", { ascending: false });
  if (costsRes.error)
    throw new Error(
      `getOperationMonthlyCosts.costs: ${costsRes.error.message}`,
    );
  const adHocItems = (costsRes.data ?? []).map((r) =>
    mapCost(r as RawCostRow),
  );
  const adHocMonthly = adHocItems
    .filter((c) => c.recurrence === "mensal")
    .reduce((s, c) => s + c.amount, 0);
  const adHocOnceTotal = adHocItems
    .filter((c) => c.recurrence === "unica")
    .reduce((s, c) => s + c.amount, 0);

  const allocRes = await supabase
    .from("allocations")
    .select(
      `
      id, capacity_weekly_pct, end_date,
      person:persons!fk_allocations_person_id(id, name, hourly_rate, archived_at),
      frente:frentes!fk_allocations_frente_id(id, operation_id, archived_at)
      `,
    )
    .or(`end_date.is.null,end_date.gt.${today}`);
  if (allocRes.error)
    throw new Error(
      `getOperationMonthlyCosts.allocations: ${allocRes.error.message}`,
    );

  const rows = (allocRes.data ?? []) as unknown as AllocJoin[];
  const allocations: AllocationCost[] = [];
  for (const a of rows) {
    const frente = pickOne(a.frente);
    const person = pickOne(a.person);
    if (!frente || frente.operation_id !== operationId) continue;
    if (frente.archived_at !== null) continue;
    if (!person || person.archived_at !== null) continue;
    const rate =
      person.hourly_rate === null || person.hourly_rate === undefined
        ? null
        : Number(person.hourly_rate);
    const capPct = Number(a.capacity_weekly_pct);
    const monthly = rate !== null ? (capPct / 100) * rate * 160 : 0;
    allocations.push({
      allocationId: a.id,
      personId: person.id,
      personName: person.name,
      capacityPct: capPct,
      hourlyRate: rate,
      monthlyCost: monthly,
    });
  }
  const allocationsTotal = allocations.reduce(
    (s, x) => s + x.monthlyCost,
    0,
  );

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
