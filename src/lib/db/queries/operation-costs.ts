import { createServer } from "@/lib/db/client";
import {
  categorySubtotals,
  type OperationCostCategory,
} from "@/lib/utils/operation-cost-category";
import { resolveOperationCostMonthlyAmount } from "@/lib/utils/operation-cost-amount";
import { computeTaxMonthlyAmount } from "@/lib/utils/operation-tax";
import { calendarDateLocalToday } from "@/lib/utils/calendar-date";
import { ACTIVE_STATUSES } from "@/lib/utils/operation-status";
import type { Database } from "@/lib/db/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CostRecurrence = Database["public"]["Enums"]["cost_recurrence"];

export type OperationCostRow = {
  id: string;
  operationId: string;
  label: string;
  /** Valor fixo em R$; null em comissões percentuais novas. */
  amount: number | null;
  commissionPercent: number | null;
  /** Valor mensal efetivo (R$), derivado de amount ou % sobre MRR líquido de imposto. */
  monthlyAmount: number;
  category: OperationCostCategory;
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
  /** Soma dos custos mensais vigentes (operation_costs recurrence=mensal). */
  fixedCost: number;
  categorySubtotals: Partial<Record<OperationCostCategory, number>>;
  adHocMonthly: number;
  adHocOnceTotal: number;
  adHocItems: OperationCostRow[];
  allocations: AllocationCost[];
  allocationsTotal: number;
  taxRatePct: number | null;
  taxMonthlyAmount: number;
  totalMonthly: number;
  chargedRevenue: number | null;
};

/** Breakdown vigente + custos futuros e projeção quando entrarem em vigor. */
export type OperationMonthlyCostsSnapshot = OperationCostBreakdown & {
  upcomingCosts: OperationCostRow[];
  projectedBreakdown: OperationCostBreakdown | null;
  /** Data (YYYY-MM-DD) a partir da qual a projeção passa a valer (mínimo entre starts futuros). */
  projectedFromDate: string | null;
};

type RawCostRow = {
  id: string;
  operation_id: string;
  label: string;
  amount: number | string | null;
  commission_percent: number | string | null;
  category: OperationCostCategory;
  recurrence: CostRecurrence;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function mapCost(
  r: RawCostRow,
  finance?: { chargedRevenue?: number | null; taxRatePct?: number | null },
): OperationCostRow {
  const amount =
    r.amount === null || r.amount === undefined ? null : Number(r.amount);
  const commissionPercent =
    r.commission_percent === null || r.commission_percent === undefined
      ? null
      : Number(r.commission_percent);
  const base = {
    id: r.id,
    operationId: r.operation_id,
    label: r.label,
    amount,
    commissionPercent,
    category: r.category,
    recurrence: r.recurrence,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
  const monthlyAmount = resolveOperationCostMonthlyAmount(
    {
      category: base.category,
      amount: base.amount,
      commissionPercent: base.commissionPercent,
    },
    finance,
  );
  return { ...base, monthlyAmount };
}

function todayISO(): string {
  return calendarDateLocalToday();
}

function earliestStartedAt(dates: string[]): string | null {
  if (dates.length === 0) return null;
  return dates.reduce((min, d) => (d < min ? d : min));
}

export async function listOperationCosts(
  operationId: string,
): Promise<OperationCostRow[]> {
  const supabase = await createServer();
  const [opRes, costsRes] = await Promise.all([
    supabase
      .from("operations")
      .select("monthly_recurring_revenue, tax_rate_pct")
      .eq("id", operationId)
      .maybeSingle(),
    supabase
      .from("operation_costs")
      .select("*")
      .eq("operation_id", operationId)
      .is("voided_at", null)
      .order("started_at", { ascending: false }),
  ]);
  if (opRes.error)
    throw new Error(`listOperationCosts.operation: ${opRes.error.message}`);
  if (costsRes.error)
    throw new Error(`listOperationCosts: ${costsRes.error.message}`);
  const chargedRevenue =
    opRes.data?.monthly_recurring_revenue === null ||
    opRes.data?.monthly_recurring_revenue === undefined
      ? null
      : Number(opRes.data.monthly_recurring_revenue);
  const taxRatePct =
    opRes.data?.tax_rate_pct === null || opRes.data?.tax_rate_pct === undefined
      ? null
      : Number(opRes.data.tax_rate_pct);
  return (costsRes.data ?? []).map((r) =>
    mapCost(r as RawCostRow, { chargedRevenue, taxRatePct }),
  );
}

export async function getOperationCost(
  id: string,
): Promise<OperationCostRow | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("operation_costs")
    .select(
      "*, operation:operations!fk_operation_costs_operation_id(monthly_recurring_revenue, tax_rate_pct)",
    )
    .eq("id", id)
    .is("voided_at", null)
    .maybeSingle();
  if (error) throw new Error(`getOperationCost: ${error.message}`);
  if (!data) return null;
  const row = data as RawCostRow & {
    operation: {
      monthly_recurring_revenue: number | null;
      tax_rate_pct: number | null;
    } | null;
  };
  const mrr =
    row.operation?.monthly_recurring_revenue === null ||
    row.operation?.monthly_recurring_revenue === undefined
      ? null
      : Number(row.operation.monthly_recurring_revenue);
  const taxRatePct =
    row.operation?.tax_rate_pct === null ||
    row.operation?.tax_rate_pct === undefined
      ? null
      : Number(row.operation.tax_rate_pct);
  return mapCost(row, { chargedRevenue: mrr, taxRatePct });
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

export type OperationCostBreakdownInput = {
  chargedRevenue?: number | null;
  taxRatePct?: number | null;
};

export function computeBreakdown(
  operationId: string,
  adHocItems: OperationCostRow[],
  allocRows: AllocJoin[],
  finance?: OperationCostBreakdownInput,
): OperationCostBreakdown {
  const chargedRevenue =
    finance?.chargedRevenue === null || finance?.chargedRevenue === undefined
      ? null
      : Number(finance.chargedRevenue);
  const financeContext = {
    chargedRevenue,
    taxRatePct:
      finance?.taxRatePct === null || finance?.taxRatePct === undefined
        ? null
        : Number(finance.taxRatePct),
  };

  const enrichedItems = adHocItems.map((c) => ({
    ...c,
    monthlyAmount: resolveOperationCostMonthlyAmount(
      {
        category: c.category,
        amount: c.amount ?? null,
        commissionPercent: c.commissionPercent ?? null,
      },
      financeContext,
    ),
  }));

  const monthlyActive = enrichedItems.filter((c) => c.recurrence === "mensal");
  const adHocMonthly = monthlyActive.reduce((s, c) => s + c.monthlyAmount, 0);
  const adHocOnceTotal = enrichedItems
    .filter((c) => c.recurrence === "unica")
    .reduce((s, c) => s + c.monthlyAmount, 0);
  const subtotals = categorySubtotals(monthlyActive);

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

  const taxRatePct = financeContext.taxRatePct;
  const taxMonthlyAmount = computeTaxMonthlyAmount(
    chargedRevenue,
    taxRatePct,
  );

  return {
    fixedCost: adHocMonthly,
    categorySubtotals: subtotals,
    adHocMonthly,
    adHocOnceTotal,
    adHocItems: enrichedItems,
    allocations,
    allocationsTotal,
    taxRatePct,
    taxMonthlyAmount,
    totalMonthly: adHocMonthly + allocationsTotal + taxMonthlyAmount,
    chargedRevenue,
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
  supabaseClient?: SupabaseClient<Database>,
): Promise<OperationMonthlyCostsSnapshot> {
  const supabase = supabaseClient ?? (await createServer());
  const today = todayISO();

  const [opRes, costsRes, upcomingRes, allocRes] = await Promise.all([
    supabase
      .from("operations")
      .select("monthly_recurring_revenue, tax_rate_pct")
      .eq("id", operationId)
      .maybeSingle(),
    supabase
      .from("operation_costs")
      .select("*")
      .eq("operation_id", operationId)
      .is("voided_at", null)
      .lte("started_at", today)
      .or(`ended_at.is.null,ended_at.gte.${today}`)
      .order("started_at", { ascending: false }),
    supabase
      .from("operation_costs")
      .select("*")
      .eq("operation_id", operationId)
      .is("voided_at", null)
      .gt("started_at", today)
      .order("started_at", { ascending: true }),
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
  if (upcomingRes.error)
    throw new Error(
      `getOperationMonthlyCosts.upcoming: ${upcomingRes.error.message}`,
    );
  if (allocRes.error)
    throw new Error(
      `getOperationMonthlyCosts.allocations: ${allocRes.error.message}`,
    );

  const chargedRevenue =
    opRes.data?.monthly_recurring_revenue === null ||
    opRes.data?.monthly_recurring_revenue === undefined
      ? null
      : Number(opRes.data.monthly_recurring_revenue);
  const taxRatePct =
    opRes.data?.tax_rate_pct === null || opRes.data?.tax_rate_pct === undefined
      ? null
      : Number(opRes.data.tax_rate_pct);
  const adHocItems = (costsRes.data ?? []).map((r) =>
    mapCost(r as RawCostRow, { chargedRevenue, taxRatePct }),
  );
  const upcomingCosts = (upcomingRes.data ?? []).map((r) =>
    mapCost(r as RawCostRow, { chargedRevenue, taxRatePct }),
  );
  const allocRows = (allocRes.data ?? []) as unknown as AllocJoin[];

  const finance = { chargedRevenue, taxRatePct };
  const breakdown = computeBreakdown(
    operationId,
    adHocItems,
    allocRows,
    finance,
  );
  const projectedBreakdown =
    upcomingCosts.length > 0
      ? computeBreakdown(
          operationId,
          [...adHocItems, ...upcomingCosts],
          allocRows,
          finance,
        )
      : null;
  const projectedFromDate = earliestStartedAt(
    upcomingCosts.map((c) => c.startedAt),
  );

  return {
    ...breakdown,
    upcomingCosts,
    projectedBreakdown,
    projectedFromDate,
  };
}

/** Breakdown mensal vigente por operação (mesma lógica que `getOperationMonthlyCosts`). */
export async function getOperationsMonthlyCostsBatch(
  operationIds: string[],
  supabaseClient?: SupabaseClient<Database>,
): Promise<Map<string, OperationCostBreakdown>> {
  const uniqueIds = [...new Set(operationIds)];
  if (uniqueIds.length === 0) return new Map();

  const supabase = supabaseClient ?? (await createServer());
  const today = todayISO();

  const [opsRes, costsRes, allocRes] = await Promise.all([
    supabase
      .from("operations")
      .select("id, monthly_recurring_revenue, tax_rate_pct")
      .in("id", uniqueIds),
    supabase
      .from("operation_costs")
      .select("*")
      .in("operation_id", uniqueIds)
      .lte("started_at", today)
      .or(`ended_at.is.null,ended_at.gte.${today}`),
    supabase
      .from("allocations")
      .select(
        `${ALLOC_SELECT_FIELDS},
        frente:frentes!fk_allocations_frente_id!inner(id, operation_id, archived_at)`,
      )
      .is("frente.archived_at", null)
      .in("frente.operation_id", uniqueIds)
      .or(`end_date.is.null,end_date.gt.${today}`),
  ]);
  if (opsRes.error) {
    throw new Error(
      `getOperationsMonthlyCostsBatch.operations: ${opsRes.error.message}`,
    );
  }
  if (costsRes.error) {
    throw new Error(
      `getOperationsMonthlyCostsBatch.costs: ${costsRes.error.message}`,
    );
  }
  if (allocRes.error) {
    throw new Error(
      `getOperationsMonthlyCostsBatch.allocations: ${allocRes.error.message}`,
    );
  }

  const costsByOp = new Map<string, OperationCostRow[]>();
  for (const r of costsRes.data ?? []) {
    const raw = r as RawCostRow;
    const opMeta = (opsRes.data ?? []).find((o) => o.id === raw.operation_id);
    const chargedForOp =
      opMeta?.monthly_recurring_revenue === null ||
      opMeta?.monthly_recurring_revenue === undefined
        ? null
        : Number(opMeta.monthly_recurring_revenue);
    const taxForOp =
      opMeta?.tax_rate_pct === null || opMeta?.tax_rate_pct === undefined
        ? null
        : Number(opMeta.tax_rate_pct);
    const cost = mapCost(raw, {
      chargedRevenue: chargedForOp,
      taxRatePct: taxForOp,
    });
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

  const out = new Map<string, OperationCostBreakdown>();
  for (const op of opsRes.data ?? []) {
    const chargedRevenue =
      op.monthly_recurring_revenue === null ||
      op.monthly_recurring_revenue === undefined
        ? null
        : Number(op.monthly_recurring_revenue);
    const taxRatePct =
      op.tax_rate_pct === null || op.tax_rate_pct === undefined
        ? null
        : Number(op.tax_rate_pct);
    out.set(
      op.id,
      computeBreakdown(
        op.id,
        costsByOp.get(op.id) ?? [],
        allocsByOp.get(op.id) ?? [],
        { chargedRevenue, taxRatePct },
      ),
    );
  }
  return out;
}

export async function getActiveOperationsMonthlyCostsTotal(): Promise<number> {
  const supabase = await createServer();
  const today = todayISO();

  const [opsRes, costsRes, allocRes] = await Promise.all([
    supabase
      .from("operations")
      .select(
        "id, monthly_recurring_revenue, tax_rate_pct, client:clients!inner(archived_at)",
      )
      .is("archived_at", null)
      .is("client.archived_at", null)
      .in("status", ACTIVE_STATUSES),
    supabase
      .from("operation_costs")
      .select(
        "*, operation:operations!fk_operation_costs_operation_id!inner(archived_at, status, monthly_recurring_revenue, tax_rate_pct)",
      )
      .is("operation.archived_at", null)
      .in("operation.status", ACTIVE_STATUSES)
      .eq("recurrence", "mensal")
      .is("voided_at", null)
      .lte("started_at", today)
      .or(`ended_at.is.null,ended_at.gte.${today}`),
    supabase
      .from("allocations")
      .select(
        `${ALLOC_SELECT_FIELDS},
        frente:frentes!fk_allocations_frente_id!inner(
          id, operation_id, archived_at,
          operation:operations!fk_frentes_operation_id!inner(archived_at, status)
        )`,
      )
      .is("frente.archived_at", null)
      .is("frente.operation.archived_at", null)
      .in("frente.operation.status", ACTIVE_STATUSES)
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
    const row = r as RawCostRow & {
      operation: {
        monthly_recurring_revenue: number | null;
        tax_rate_pct: number | null;
      };
    };
    const chargedForOp =
      row.operation.monthly_recurring_revenue === null ||
      row.operation.monthly_recurring_revenue === undefined
        ? null
        : Number(row.operation.monthly_recurring_revenue);
    const taxForOp =
      row.operation.tax_rate_pct === null ||
      row.operation.tax_rate_pct === undefined
        ? null
        : Number(row.operation.tax_rate_pct);
    const cost = mapCost(row, {
      chargedRevenue: chargedForOp,
      taxRatePct: taxForOp,
    });
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

  let total = 0;
  for (const op of opsRes.data ?? []) {
    const chargedRevenue =
      op.monthly_recurring_revenue === null ||
      op.monthly_recurring_revenue === undefined
        ? null
        : Number(op.monthly_recurring_revenue);
    const taxRatePct =
      op.tax_rate_pct === null || op.tax_rate_pct === undefined
        ? null
        : Number(op.tax_rate_pct);
    const breakdown = computeBreakdown(
      op.id,
      costsByOp.get(op.id) ?? [],
      allocsByOp.get(op.id) ?? [],
      { chargedRevenue, taxRatePct },
    );
    total += breakdown.totalMonthly;
  }
  return total;
}

export async function voidOperationCost(
  id: string,
  reason?: string | null,
  supabaseClient?: SupabaseClient<Database>,
): Promise<{ operationId: string }> {
  const supabase = supabaseClient ?? (await createServer());
  const trimmedReason = reason?.trim() ? reason.trim().slice(0, 500) : null;
  const { data, error } = await supabase
    .from("operation_costs")
    .update({
      voided_at: new Date().toISOString(),
      void_reason: trimmedReason,
    })
    .eq("id", id)
    .is("voided_at", null)
    .select("operation_id")
    .maybeSingle();
  if (error) throw new Error(`voidOperationCost: ${error.message}`);
  if (!data) throw new Error("voidOperationCost: not_found_or_already_voided");
  return { operationId: data.operation_id };
}
