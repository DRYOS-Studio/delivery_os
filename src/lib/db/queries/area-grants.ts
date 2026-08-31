import { createServer } from "@/lib/db/client";

export type GrantClient = { id: string; name: string };
export type GrantOperation = { id: string; name: string; clientName: string };

/** Clientes concedidos a uma área. */
export async function listAreaClients(areaId: string): Promise<GrantClient[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("area_clients")
    .select("client:clients!fk_area_clients_client_id ( id, name )")
    .eq("area_id", areaId);
  if (error) throw new Error(`listAreaClients: ${error.message}`);
  type Row = { client: GrantClient | GrantClient[] | null };
  return ((data ?? []) as Row[])
    .map((r) => (Array.isArray(r.client) ? (r.client[0] ?? null) : r.client))
    .filter((c): c is GrantClient => c != null);
}

/** Operações concedidas a uma área. */
export async function listAreaOperations(
  areaId: string,
): Promise<GrantOperation[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("area_operations")
    .select(
      "operation:operations!fk_area_operations_operation_id ( id, name, client:clients!fk_operations_client_id ( name ) )",
    )
    .eq("area_id", areaId);
  if (error) throw new Error(`listAreaOperations: ${error.message}`);
  type Op = { id: string; name: string; client: { name: string } | { name: string }[] | null };
  type Row = { operation: Op | Op[] | null };
  return ((data ?? []) as Row[])
    .map((r) => (Array.isArray(r.operation) ? (r.operation[0] ?? null) : r.operation))
    .filter((o): o is Op => o != null)
    .map((o) => {
      const c = Array.isArray(o.client) ? (o.client[0] ?? null) : o.client;
      return { id: o.id, name: o.name, clientName: c?.name ?? "—" };
    });
}

/** Todos os clientes (pra conceder). RLS: admin vê todos. */
export async function listGrantableClients(): Promise<GrantClient[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name")
    .is("archived_at", null)
    .order("name", { ascending: true });
  if (error) throw new Error(`listGrantableClients: ${error.message}`);
  return data ?? [];
}

/** Todas as operações (pra conceder), com nome do cliente. */
export async function listGrantableOperations(): Promise<GrantOperation[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("operations")
    .select(
      "id, name, client:clients!fk_operations_client_id!inner ( name, archived_at )",
    )
    .is("archived_at", null)
    .is("client.archived_at", null)
    .order("name", { ascending: true });
  if (error) throw new Error(`listGrantableOperations: ${error.message}`);
  type Row = { id: string; name: string; client: { name: string } | { name: string }[] | null };
  return ((data ?? []) as Row[]).map((o) => {
    const c = Array.isArray(o.client) ? (o.client[0] ?? null) : o.client;
    return { id: o.id, name: o.name, clientName: c?.name ?? "—" };
  });
}
