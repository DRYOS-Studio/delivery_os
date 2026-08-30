import { createServer } from "@/lib/db/client";
import { ACTIVE_STATUSES } from "@/lib/utils/operation-status";
import type { Database } from "@/lib/db/types";
import { isOpenStatus, type TaskStatus } from "@/lib/db/queries/tasks";

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

/**
 * `scope: "ativa"`  → agregados e grids (exclui status terminal).
 * `scope: "visivel"` → listas de detalhe (Cliente, Pessoa): a Operação encerrada
 *   PRECISA continuar aparecendo, senão o usuário não a alcança para arquivar.
 * Os dois excluem Operação de Cliente arquivado.
 */
export async function getActiveOperations(
  options: { clientId?: string; scope?: "ativa" | "visivel" } = {},
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
      client:clients!inner(name, slug, archived_at),
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
    .is("client.archived_at", null)
    .order("created_at", { ascending: false });

  if ((options.scope ?? "ativa") === "ativa") {
    query = query.in("status", ACTIVE_STATUSES);
  }

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
  archivedAt: string | null;
};

const LIST_SELECT = `
  id, name, client_id, product_line, status, recurrence,
  monthly_recurring_revenue, start_date, end_date, created_at, archived_at,
  client:clients!inner(name, slug, archived_at),
  frentes(id, archived_at, phase)
`;

/**
 * Predicado VISÍVEL: `archived_at IS NULL` + Cliente dono não arquivado.
 * **Sem filtro de status** — de propósito. Operação `concluida`/`cancelada` continua
 * listada (com a pill do status) porque é por esta lista que se chega nela para
 * arquivar; filtrar por status aqui recriaria o beco sem saída.
 *
 * `includeArchived` serve só a seção "Arquivados" de `/operations`. Os arquivados
 * vêm na mesma query e a página separa em JS (padrão de catalog/products).
 */
export async function listOperations(
  options: { search?: string | undefined; includeArchived?: boolean } = {},
): Promise<OperationListItem[]> {
  const supabase = await createServer();
  const search = options.search?.trim();
  const includeArchived = options.includeArchived ?? false;

  const base = () => {
    const q = supabase.from("operations").select(LIST_SELECT);
    return includeArchived ? q : q.is("archived_at", null);
  };

  // Sem search: query direta com embed
  if (!search) {
    const { data, error } = await base()
      .is("client.archived_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`listOperations: ${error.message}`);
    return (data ?? []).map(toListItem);
  }

  // Com search: PostgREST não suporta OR cross-table simples;
  // 2 queries paralelas + dedupe.
  const escaped = search.replace(/[%_]/g, (m) => `\\${m}`);
  const [byOpName, byClientName] = await Promise.all([
    base()
      .is("client.archived_at", null)
      .ilike("name", `%${escaped}%`)
      .order("created_at", { ascending: false }),
    base()
      .is("client.archived_at", null)
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
  archived_at: string | null;
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
    archivedAt: row.archived_at,
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
  responsibleName: string | null;
  openTasksCount: number;
};

export type OperationDetail = {
  id: string;
  name: string;
  productLine: Op["product_line"];
  status: Op["status"];
  recurrence: Op["recurrence"];
  monthlyRecurringRevenue: number | null;
  monthlyFixedCost: number | null;
  responseHours: number | null;
  resolutionHours: number | null;
  diagnosticId: string | null;
  startDate: string | null;
  endDate: string | null;
  notificationWebhookUrl: string | null;
  createdAt: string;
  client: { id: string; name: string; slug: string };
  frentes: FrenteListItem[];
};

/**
 * VISÍVEL. `includeArchived` existe para o restore: sem ele a action leria a Operação
 * arquivada e receberia `not_found` em 100% dos casos.
 */
export async function getOperation(
  id: string,
  options: { includeArchived?: boolean } = {},
): Promise<OperationDetail | null> {
  const supabase = await createServer();
  const q = supabase
    .from("operations")
    .select(
      `
      id, name, product_line, status, recurrence,
      monthly_recurring_revenue, monthly_fixed_cost,
      response_hours, resolution_hours,
      diagnostic_id, start_date, end_date, notification_webhook_url,
      created_at,
      client:clients!inner(id, name, slug, archived_at),
      frentes(
        id, name, cycle_type, domain, phase,
        actionable_status, actionable_status_since,
        responsible_person_id, archived_at, created_at,
        responsible:persons!fk_frentes_responsible_person_id(name),
        tasks(id, status, parent_task_id)
      )
      `,
    )
    .eq("id", id)
    .is("client.archived_at", null);
  const { data, error } = await (options.includeArchived
    ? q
    : q.is("archived_at", null)
  ).maybeSingle();
  if (error) throw new Error(`getOperation: ${error.message}`);
  if (!data || !data.client) return null;

  const frentes: FrenteListItem[] = (data.frentes ?? [])
    .filter((f) => f.archived_at === null)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((f) => {
      const tasksList =
        (
          f as unknown as {
            tasks?: Array<{
              status: TaskStatus;
              parent_task_id: string | null;
            }>;
          }
        ).tasks ?? [];
      // Subtarefa não conta: mesma regra do header do detalhe da Frente
      // (app/operations/[id]/frentes/[fid]/page.tsx). Contar as duas coisas
      // fazia a mesma Frente mostrar números diferentes nas duas telas.
      const openTasksCount = tasksList.filter(
        (t) => t.parent_task_id === null && isOpenStatus(t.status),
      ).length;
      return {
        id: f.id,
        name: f.name,
        cycleType: f.cycle_type,
        domain: f.domain,
        phase: f.phase,
        actionableStatus: f.actionable_status,
        actionableStatusSince: f.actionable_status_since,
        responsiblePersonId: f.responsible_person_id,
        responsibleName: f.responsible?.name ?? null,
        openTasksCount,
      };
    });

  return {
    id: data.id,
    name: data.name,
    productLine: data.product_line,
    status: data.status,
    recurrence: data.recurrence,
    monthlyRecurringRevenue: data.monthly_recurring_revenue,
    monthlyFixedCost: data.monthly_fixed_cost,
    responseHours: data.response_hours,
    resolutionHours: data.resolution_hours,
    diagnosticId: data.diagnostic_id,
    startDate: data.start_date,
    endDate: data.end_date,
    notificationWebhookUrl: data.notification_webhook_url,
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
    .select("id, client:clients!inner(archived_at)", {
      count: "exact",
      head: true,
    })
    .is("archived_at", null)
    .is("client.archived_at", null)
    .in("status", ACTIVE_STATUSES);
  if (error) throw new Error(`countActiveOperations: ${error.message}`);
  return count ?? 0;
}

export type OperationWithFrentes = {
  id: string;
  name: string;
  clientName: string;
  frentes: { id: string; name: string }[];
};

/**
 * Operações visíveis (RLS) não-arquivadas, cada uma com suas Frentes ativas.
 * Alimenta pickers em cascata (Operação → Frente) sem round-trips por seleção.
 * Operações sem Frente ativa são omitidas — não há onde criar a tarefa.
 */
export async function listOperationsWithFrentes(): Promise<
  OperationWithFrentes[]
> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("operations")
    .select(
      `
      id, name,
      client:clients!fk_operations_client_id!inner (name, archived_at),
      frentes (id, name, archived_at)
      `,
    )
    .is("archived_at", null)
    .is("client.archived_at", null)
    .in("status", ACTIVE_STATUSES)
    .order("name", { ascending: true });
  if (error) throw new Error(`listOperationsWithFrentes: ${error.message}`);
  if (!data) return [];

  type Row = {
    id: string;
    name: string;
    client: { name: string } | { name: string }[] | null;
    frentes:
      | { id: string; name: string; archived_at: string | null }[]
      | null;
  };

  return (data as unknown as Row[])
    .map((op): OperationWithFrentes => {
      const client = Array.isArray(op.client) ? op.client[0] : op.client;
      const frentes = (op.frentes ?? [])
        .filter((f) => f.archived_at === null)
        .map((f) => ({ id: f.id, name: f.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      return {
        id: op.id,
        name: op.name,
        clientName: client?.name ?? "—",
        frentes,
      };
    })
    .filter((op) => op.frentes.length > 0);
}

