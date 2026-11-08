import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type RepositoryLinkRow = {
  id: string;
  clientId: string;
  operationId: string | null;
  frenteId: string | null;
  label: string;
  url: string;
  notes: string | null;
  sortOrder: number;
};

type DbRow = Database["public"]["Tables"]["repository_links"]["Row"];

function mapRow(row: DbRow): RepositoryLinkRow {
  return {
    id: row.id,
    clientId: row.client_id,
    operationId: row.operation_id,
    frenteId: row.frente_id,
    label: row.label,
    url: row.url,
    notes: row.notes,
    sortOrder: row.sort_order,
  };
}

export async function listRepositoryLinksForClient(
  clientId: string,
): Promise<RepositoryLinkRow[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("repository_links")
    .select("*")
    .eq("client_id", clientId)
    .is("operation_id", null)
    .is("frente_id", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listRepositoryLinksForClient: ${error.message}`);
  return (data ?? []).map(mapRow);
}

export async function listRepositoryLinksForOperation(
  clientId: string,
  operationId: string,
): Promise<RepositoryLinkRow[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("repository_links")
    .select("*")
    .eq("client_id", clientId)
    .or(
      `and(operation_id.eq.${operationId},frente_id.is.null),and(operation_id.is.null,frente_id.is.null)`,
    )
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(`listRepositoryLinksForOperation: ${error.message}`);
  }
  return (data ?? []).map(mapRow);
}

export async function listRepositoryLinksForFrente(
  clientId: string,
  operationId: string,
  frenteId: string,
): Promise<RepositoryLinkRow[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("repository_links")
    .select("*")
    .eq("client_id", clientId)
    .or(
      `frente_id.eq.${frenteId},and(operation_id.eq.${operationId},frente_id.is.null),and(operation_id.is.null,frente_id.is.null)`,
    )
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listRepositoryLinksForFrente: ${error.message}`);
  return (data ?? []).map(mapRow);
}

export async function listRepositoryLinksScopedToOperationOnly(
  operationId: string,
): Promise<RepositoryLinkRow[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("repository_links")
    .select("*")
    .eq("operation_id", operationId)
    .is("frente_id", null)
    .order("sort_order", { ascending: true });
  if (error) {
    throw new Error(`listRepositoryLinksScopedToOperationOnly: ${error.message}`);
  }
  return (data ?? []).map(mapRow);
}

export async function listRepositoryLinksScopedToFrenteOnly(
  frenteId: string,
): Promise<RepositoryLinkRow[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("repository_links")
    .select("*")
    .eq("frente_id", frenteId)
    .order("sort_order", { ascending: true });
  if (error) {
    throw new Error(`listRepositoryLinksScopedToFrenteOnly: ${error.message}`);
  }
  return (data ?? []).map(mapRow);
}
