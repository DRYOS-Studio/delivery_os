import { createServer } from "@/lib/db/client";
import { getOperationMonthlyCosts } from "@/lib/db/queries/operation-costs";
import { STALENESS_THRESHOLDS } from "@/lib/utils/staleness";

export type DashboardSummary = {
  mrrTotal: number;
  activeOperations: number;
  archivedOperations: number;
  frentesHealthy: number;
  frentesStale: number;
  quickWinsLast30d: number;
  internalPersons: number;
  externalPersons: number;
  openAllocations: number;
  openTasks: number;
  monthlyCostsTotal: number;
  monthlyMarginTotal: number;
};

export type ClientMRR = {
  clientId: string;
  name: string;
  mrr: number;
};

export type VillainFrequency = {
  villainId: string;
  name: string;
  count: number;
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const supabase = await createServer();

  const staleThreshold = new Date(
    Date.now() - STALENESS_THRESHOLDS.hot * 86_400_000,
  ).toISOString();
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [
    opsRes,
    frentesRes,
    qwCountRes,
    internalCountRes,
    externalCountRes,
    openAllocsRes,
    openTasksRes,
  ] = await Promise.all([
    supabase
      .from("operations")
      .select("id, monthly_recurring_revenue, archived_at"),
    supabase
      .from("frentes")
      .select("actionable_status, updated_at")
      .is("archived_at", null),
    supabase
      .from("quick_wins")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since30),
    supabase
      .from("persons")
      .select("id", { count: "exact", head: true })
      .eq("kind", "internal")
      .is("archived_at", null),
    supabase
      .from("persons")
      .select("id", { count: "exact", head: true })
      .eq("kind", "external")
      .is("archived_at", null),
    supabase
      .from("allocations")
      .select("id", { count: "exact", head: true })
      .is("end_date", null),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .in("status", ["todo", "doing", "blocked"]),
  ]);

  if (opsRes.error)
    throw new Error(`dashboard.getDashboardSummary.ops: ${opsRes.error.message}`);
  if (frentesRes.error)
    throw new Error(
      `dashboard.getDashboardSummary.frentes: ${frentesRes.error.message}`,
    );
  if (qwCountRes.error)
    throw new Error(
      `dashboard.getDashboardSummary.qw: ${qwCountRes.error.message}`,
    );
  if (internalCountRes.error)
    throw new Error(
      `dashboard.getDashboardSummary.internal: ${internalCountRes.error.message}`,
    );
  if (externalCountRes.error)
    throw new Error(
      `dashboard.getDashboardSummary.external: ${externalCountRes.error.message}`,
    );
  if (openAllocsRes.error)
    throw new Error(
      `dashboard.getDashboardSummary.allocs: ${openAllocsRes.error.message}`,
    );
  if (openTasksRes.error)
    throw new Error(
      `dashboard.getDashboardSummary.tasks: ${openTasksRes.error.message}`,
    );

  const ops = opsRes.data ?? [];
  const active = ops.filter((o) => !o.archived_at);
  const mrrTotal = active.reduce(
    (sum, o) => sum + (o.monthly_recurring_revenue ?? 0),
    0,
  );
  const activeOperations = active.length;
  const archivedOperations = ops.length - activeOperations;

  const frentes = frentesRes.data ?? [];
  const frentesHealthy = frentes.filter(
    (f) =>
      f.actionable_status !== null &&
      f.actionable_status !== "" &&
      f.updated_at > staleThreshold,
  ).length;
  const frentesStale = frentes.length - frentesHealthy;

  const activeOpIds = active.map((o) => o.id).filter((x): x is string => !!x);
  const monthlyCosts = await Promise.all(
    activeOpIds.map((opId) => getOperationMonthlyCosts(opId)),
  );
  const monthlyCostsTotal = monthlyCosts.reduce(
    (sum, b) => sum + b.totalMonthly,
    0,
  );
  const monthlyMarginTotal = mrrTotal - monthlyCostsTotal;

  return {
    mrrTotal,
    activeOperations,
    archivedOperations,
    frentesHealthy,
    frentesStale,
    quickWinsLast30d: qwCountRes.count ?? 0,
    internalPersons: internalCountRes.count ?? 0,
    externalPersons: externalCountRes.count ?? 0,
    openAllocations: openAllocsRes.count ?? 0,
    openTasks: openTasksRes.count ?? 0,
    monthlyCostsTotal,
    monthlyMarginTotal,
  };
}

type OpClientJoin = {
  client_id: string;
  monthly_recurring_revenue: number | null;
  clients: { id: string; name: string } | { id: string; name: string }[] | null;
};

function pickClient(
  row: OpClientJoin,
): { id: string; name: string } | null {
  const c = row.clients;
  if (!c) return null;
  if (Array.isArray(c)) return c[0] ?? null;
  return c;
}

export async function getTopClientsByMRR(limit = 5): Promise<ClientMRR[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("operations")
    .select(
      "client_id, monthly_recurring_revenue, clients!inner(id, name)",
    )
    .is("archived_at", null);

  if (error)
    throw new Error(`dashboard.getTopClientsByMRR: ${error.message}`);

  const rows = (data ?? []) as unknown as OpClientJoin[];
  const byClient = new Map<string, ClientMRR>();
  for (const row of rows) {
    const c = pickClient(row);
    if (!c) continue;
    const cur = byClient.get(c.id) ?? {
      clientId: c.id,
      name: c.name,
      mrr: 0,
    };
    cur.mrr += row.monthly_recurring_revenue ?? 0;
    byClient.set(c.id, cur);
  }

  return Array.from(byClient.values())
    .filter((c) => c.mrr > 0)
    .sort((a, b) => b.mrr - a.mrr)
    .slice(0, limit);
}

type OpVillainJoin = {
  villain_id: string;
  villains:
    | { id: string; name: string; archived_at: string | null }
    | { id: string; name: string; archived_at: string | null }[]
    | null;
};

function pickVillain(
  row: OpVillainJoin,
): { id: string; name: string; archived_at: string | null } | null {
  const v = row.villains;
  if (!v) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

export async function getTopVillainsByFrequency(
  limit = 5,
): Promise<VillainFrequency[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("operation_villains")
    .select("villain_id, villains!inner(id, name, archived_at)");

  if (error)
    throw new Error(`dashboard.getTopVillainsByFrequency: ${error.message}`);

  const rows = (data ?? []) as unknown as OpVillainJoin[];
  const byVillain = new Map<string, VillainFrequency>();
  for (const row of rows) {
    const v = pickVillain(row);
    if (!v) continue;
    if (v.archived_at) continue;
    const cur = byVillain.get(v.id) ?? {
      villainId: v.id,
      name: v.name,
      count: 0,
    };
    cur.count += 1;
    byVillain.set(v.id, cur);
  }

  return Array.from(byVillain.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
