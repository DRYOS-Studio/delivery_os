import { createServer } from "@/lib/db/client";
import {
  ACTIVE_STATUSES,
  isActiveStatus,
} from "@/lib/utils/operation-status";
import type { Database } from "@/lib/db/types";

export type ClientDetail = Database["public"]["Tables"]["clients"]["Row"];

export type ClientListItem = {
  id: string;
  name: string;
  slug: string;
  notes: string | null;
  createdAt: string;
  operationsActive: number;
  externalPersons: number;
  archivedAt: string | null;
};

/**
 * `includeArchived` só para a seção "Arquivados" de `/clients`. Default `false` de
 * propósito: dos 5 call-sites, 4 são picker de Cliente (nova Operação, editar Operação,
 * nova Pessoa, editar Pessoa) — trazer arquivados sem escopo poria Cliente arquivado
 * como opção no `<select>`.
 */
export async function listClients(
  options: { search?: string | undefined; includeArchived?: boolean } = {},
): Promise<ClientListItem[]> {
  const supabase = await createServer();
  const search = options.search?.trim();

  let query = supabase
    .from("clients")
    .select(
      `
      id,
      name,
      slug,
      notes,
      created_at,
      archived_at,
      operations(id, archived_at, status),
      persons!fk_persons_client_id(id, archived_at, kind)
      `,
    )
    .order("name", { ascending: true });

  if (!(options.includeArchived ?? false)) {
    query = query.is("archived_at", null);
  }

  if (search) {
    const escaped = search.replace(/[%_]/g, (m) => `\\${m}`);
    query = query.or(`name.ilike.%${escaped}%,slug.ilike.%${escaped}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`listClients: ${error.message}`);
  if (!data) return [];

  return data.map((c): ClientListItem => {
    const operationsActive = (c.operations ?? []).filter(
      (op) => op.archived_at === null && isActiveStatus(op.status),
    ).length;
    const externalPersons = (c.persons ?? []).filter(
      (p) => p.kind === "external" && p.archived_at === null,
    ).length;
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      notes: c.notes,
      createdAt: c.created_at,
      operationsActive,
      externalPersons,
      archivedAt: c.archived_at,
    };
  });
}

export async function getClient(id: string): Promise<ClientDetail | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error(`getClient: ${error.message}`);
  return data;
}

export async function countActiveClients(): Promise<number> {
  const supabase = await createServer();
  const { count, error } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .is("archived_at", null);
  if (error) throw new Error(`countActiveClients: ${error.message}`);
  return count ?? 0;
}

export type ClientSummary = {
  activeOperations: number;
  archivedOperations: number;
  activeFrentes: number;
  mrrTotal: number;
};

export async function getClientSummary(
  clientId: string,
): Promise<ClientSummary> {
  const supabase = await createServer();

  const opsRes = await supabase
    .from("operations")
    .select("id, archived_at, status, monthly_recurring_revenue")
    .eq("client_id", clientId);
  if (opsRes.error)
    throw new Error(`getClientSummary.ops: ${opsRes.error.message}`);

  const ops = opsRes.data ?? [];
  // ATIVA = não arquivada E status não-terminal. Operação concluída/cancelada para de
  // somar MRR — é a promessa central de encerrar um projeto.
  const active = ops.filter((o) => !o.archived_at && isActiveStatus(o.status));
  const activeOperations = active.length;
  // Contado DIRETO, não por complemento: `ops.length - activeOperations` faria a
  // Operação concluída (não arquivada) aparecer como "arquivada" no card.
  const archivedOperations = ops.filter((o) => o.archived_at !== null).length;
  const mrrTotal = active.reduce(
    (sum, o) => sum + (o.monthly_recurring_revenue ?? 0),
    0,
  );

  let activeFrentes = 0;
  const activeOpIds = active.map((o) => o.id);
  if (activeOpIds.length > 0) {
    const frentesRes = await supabase
      .from("frentes")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null)
      .in("operation_id", activeOpIds);
    if (frentesRes.error)
      throw new Error(
        `getClientSummary.frentes: ${frentesRes.error.message}`,
      );
    activeFrentes = frentesRes.count ?? 0;
  }

  return {
    activeOperations,
    archivedOperations,
    activeFrentes,
    mrrTotal,
  };
}

/** Quantas Operações do Cliente ainda estão ATIVAS — alimenta o motivo do bloqueio. */
export async function countActiveOperationsByClient(
  clientId: string,
): Promise<number> {
  const supabase = await createServer();
  const { count, error } = await supabase
    .from("operations")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .is("archived_at", null)
    .in("status", ACTIVE_STATUSES);
  if (error)
    throw new Error(`countActiveOperationsByClient: ${error.message}`);
  return count ?? 0;
}

export async function clientHasActiveOperations(
  clientId: string,
): Promise<boolean> {
  const supabase = await createServer();
  const { count, error } = await supabase
    .from("operations")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .is("archived_at", null)
    .in("status", ACTIVE_STATUSES);
  if (error) throw new Error(`clientHasActiveOperations: ${error.message}`);
  return (count ?? 0) > 0;
}
