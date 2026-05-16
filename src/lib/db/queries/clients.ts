import { createServer } from "@/lib/db/client";
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
};

export async function listClients(
  options: { search?: string | undefined } = {},
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
      operations(id, archived_at, status),
      persons!fk_persons_client_id(id, archived_at, kind)
      `,
    )
    .is("archived_at", null)
    .order("name", { ascending: true });

  if (search) {
    const escaped = search.replace(/[%_]/g, (m) => `\\${m}`);
    query = query.or(`name.ilike.%${escaped}%,slug.ilike.%${escaped}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`listClients: ${error.message}`);
  if (!data) return [];

  return data.map((c): ClientListItem => {
    const operationsActive = (c.operations ?? []).filter(
      (op) => op.archived_at === null && op.status !== "arquivada",
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

export async function clientHasActiveOperations(
  clientId: string,
): Promise<boolean> {
  const supabase = await createServer();
  const { count, error } = await supabase
    .from("operations")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .is("archived_at", null)
    .neq("status", "arquivada");
  if (error) throw new Error(`clientHasActiveOperations: ${error.message}`);
  return (count ?? 0) > 0;
}
