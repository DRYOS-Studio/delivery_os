import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

type Op = Database["public"]["Tables"]["operations"]["Row"];
type Frente = Database["public"]["Tables"]["frentes"]["Row"];

type FrenteForCard = Pick<
  Frente,
  | "id"
  | "name"
  | "cycle_type"
  | "actionable_status"
  | "actionable_status_since"
  | "created_at"
>;

export type OperationCardData = {
  id: string;
  clientName: string;
  operationName: string;
  productLine: Op["product_line"];
  status: Op["status"];
  firstFrente: FrenteForCard | null;
  teamSize: number;
};

export async function getActiveOperations(
  options: { clientId?: string } = {},
): Promise<OperationCardData[]> {
  const supabase = await createServer();

  let query = supabase
    .from("operations")
    .select(
      `
      id,
      name,
      status,
      product_line,
      client:clients(name, slug),
      frentes(
        id,
        name,
        cycle_type,
        actionable_status,
        actionable_status_since,
        created_at,
        allocations(id)
      )
      `,
    )
    .is("archived_at", null)
    .neq("status", "arquivada")
    .order("created_at", { ascending: false });

  if (options.clientId) {
    query = query.eq("client_id", options.clientId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`getActiveOperations: ${error.message}`);
  }

  if (!data) return [];

  return data.map((op): OperationCardData => {
    const frentes = (op.frentes ?? []).slice().sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return aTime - bTime;
    });

    const firstFrenteRow = frentes[0] ?? null;

    const teamSize = (op.frentes ?? []).reduce(
      (sum, f) => sum + (f.allocations?.length ?? 0),
      0,
    );

    return {
      id: op.id,
      clientName: op.client?.name ?? "—",
      operationName: op.name,
      productLine: op.product_line,
      status: op.status,
      firstFrente: firstFrenteRow
        ? {
            id: firstFrenteRow.id,
            name: firstFrenteRow.name,
            cycle_type: firstFrenteRow.cycle_type,
            actionable_status: firstFrenteRow.actionable_status,
            actionable_status_since: firstFrenteRow.actionable_status_since,
            created_at: firstFrenteRow.created_at,
          }
        : null,
      teamSize,
    };
  });
}

// =============================================================================
// Listagem completa pra tabela /operations
// =============================================================================

export type OperationListItem = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  clientSlug: string;
  productLine: Op["product_line"];
  status: Op["status"];
  recurrence: Op["recurrence"];
  monthlyRecurringRevenue: number | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  activeFrentes: number;
};

export async function listOperations(
  options: { search?: string | undefined } = {},
): Promise<OperationListItem[]> {
  const supabase = await createServer();
  const search = options.search?.trim();

  // Sem search: query direta com embed
  if (!search) {
    const { data, error } = await supabase
      .from("operations")
      .select(
        `
        id, name, client_id, product_line, status, recurrence,
        monthly_recurring_revenue, start_date, end_date, created_at,
        client:clients(name, slug),
        frentes(id, archived_at, phase)
        `,
      )
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`listOperations: ${error.message}`);
    return (data ?? []).map(toListItem);
  }

  // Com search: PostgREST não suporta OR cross-table simples;
  // 2 queries paralelas + dedupe.
  const escaped = search.replace(/[%_]/g, (m) => `\\${m}`);
  const [byOpName, byClientName] = await Promise.all([
    supabase
      .from("operations")
      .select(
        `
        id, name, client_id, product_line, status, recurrence,
        monthly_recurring_revenue, start_date, end_date, created_at,
        client:clients(name, slug),
        frentes(id, archived_at, phase)
        `,
      )
      .is("archived_at", null)
      .ilike("name", `%${escaped}%`)
      .order("created_at", { ascending: false }),
    supabase
      .from("operations")
      .select(
        `
        id, name, client_id, product_line, status, recurrence,
        monthly_recurring_revenue, start_date, end_date, created_at,
        client:clients!inner(name, slug),
        frentes(id, archived_at, phase)
        `,
      )
      .is("archived_at", null)
      .ilike("client.name", `%${escaped}%`)
      .order("created_at", { ascending: false }),
  ]);
  if (byOpName.error) throw new Error(`listOperations(byOp): ${byOpName.error.message}`);
  if (byClientName.error)
    throw new Error(`listOperations(byClient): ${byClientName.error.message}`);

  const merged = new Map<string, ReturnType<typeof toListItem>>();
  for (const row of byOpName.data ?? []) merged.set(row.id, toListItem(row));
  for (const row of byClientName.data ?? [])
    if (!merged.has(row.id)) merged.set(row.id, toListItem(row));

  return Array.from(merged.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

type ListRow = {
  id: string;
  name: string;
  client_id: string;
  product_line: Op["product_line"];
  status: Op["status"];
  recurrence: Op["recurrence"];
  monthly_recurring_revenue: number | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  client: { name: string; slug: string } | null;
  frentes: { id: string; archived_at: string | null; phase: string }[] | null;
};

function toListItem(row: ListRow): OperationListItem {
  const activeFrentes = (row.frentes ?? []).filter(
    (f) => f.archived_at === null && f.phase !== "encerrada",
  ).length;
  return {
    id: row.id,
    name: row.name,
    clientId: row.client_id,
    clientName: row.client?.name ?? "—",
    clientSlug: row.client?.slug ?? "—",
    productLine: row.product_line,
    status: row.status,
    recurrence: row.recurrence,
    monthlyRecurringRevenue: row.monthly_recurring_revenue,
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
    activeFrentes,
  };
}

// =============================================================================
// Detalhe da Operação
// =============================================================================

export type FrenteListItem = {
  id: string;
  name: string;
  cycleType: Database["public"]["Enums"]["frente_cycle_type"];
  domain: Database["public"]["Enums"]["frente_domain"];
  phase: Database["public"]["Enums"]["frente_phase"];
  actionableStatus: string;
  actionableStatusSince: string;
  responsiblePersonId: string | null;
};

export type OperationDetail = {
  id: string;
  name: string;
  productLine: Op["product_line"];
  status: Op["status"];
  recurrence: Op["recurrence"];
  monthlyRecurringRevenue: number | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  client: { id: string; name: string; slug: string };
  frentes: FrenteListItem[];
};

export async function getOperation(id: string): Promise<OperationDetail | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("operations")
    .select(
      `
      id, name, product_line, status, recurrence,
      monthly_recurring_revenue, start_date, end_date, created_at,
      client:clients(id, name, slug),
      frentes(
        id, name, cycle_type, domain, phase,
        actionable_status, actionable_status_since,
        responsible_person_id, archived_at, created_at
      )
      `,
    )
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error(`getOperation: ${error.message}`);
  if (!data || !data.client) return null;

  const frentes: FrenteListItem[] = (data.frentes ?? [])
    .filter((f) => f.archived_at === null)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((f) => ({
      id: f.id,
      name: f.name,
      cycleType: f.cycle_type,
      domain: f.domain,
      phase: f.phase,
      actionableStatus: f.actionable_status,
      actionableStatusSince: f.actionable_status_since,
      responsiblePersonId: f.responsible_person_id,
    }));

  return {
    id: data.id,
    name: data.name,
    productLine: data.product_line,
    status: data.status,
    recurrence: data.recurrence,
    monthlyRecurringRevenue: data.monthly_recurring_revenue,
    startDate: data.start_date,
    endDate: data.end_date,
    createdAt: data.created_at,
    client: {
      id: data.client.id,
      name: data.client.name,
      slug: data.client.slug,
    },
    frentes,
  };
}

export async function countActiveOperations(): Promise<number> {
  const supabase = await createServer();
  const { count, error } = await supabase
    .from("operations")
    .select("id", { count: "exact", head: true })
    .is("archived_at", null)
    .neq("status", "arquivada");
  if (error) throw new Error(`countActiveOperations: ${error.message}`);
  return count ?? 0;
}

export async function operationHasActiveFrentes(
  operationId: string,
): Promise<boolean> {
  const supabase = await createServer();
  const { count, error } = await supabase
    .from("frentes")
    .select("id", { count: "exact", head: true })
    .eq("operation_id", operationId)
    .is("archived_at", null);
  if (error)
    throw new Error(`operationHasActiveFrentes: ${error.message}`);
  return (count ?? 0) > 0;
}
