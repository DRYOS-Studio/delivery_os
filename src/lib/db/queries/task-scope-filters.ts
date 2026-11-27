import { createServer } from "@/lib/db/client";

export type TaskScopeFilterOptions = {
  clients: { id: string; name: string }[];
  operations: { id: string; name: string; clientId: string }[];
  frentes: { id: string; name: string; operationId: string }[];
};

/**
 * Opções de escopo para filtros da lista `/tasks`. RLS restringe membro não-admin
 * às operações (e clientes/frentes derivados) em que está alocado.
 */
export async function listTaskScopeFilterOptions(): Promise<TaskScopeFilterOptions> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("operations")
    .select(
      `
      id, name, client_id,
      client:clients!fk_operations_client_id!inner ( id, name, archived_at ),
      frentes ( id, name, archived_at )
      `,
    )
    .is("archived_at", null)
    .is("client.archived_at", null)
    .order("name", { ascending: true });
  if (error) throw new Error(`listTaskScopeFilterOptions: ${error.message}`);
  if (!data) {
    return { clients: [], operations: [], frentes: [] };
  }

  type Row = {
    id: string;
    name: string;
    client_id: string;
    client: { id: string; name: string } | { id: string; name: string }[] | null;
    frentes:
      | { id: string; name: string; archived_at: string | null }[]
      | null;
  };

  const clientsMap = new Map<string, { id: string; name: string }>();
  const operations: TaskScopeFilterOptions["operations"] = [];
  const frentes: TaskScopeFilterOptions["frentes"] = [];

  for (const row of data as unknown as Row[]) {
    const client = Array.isArray(row.client) ? row.client[0] : row.client;
    if (!client) continue;
    clientsMap.set(client.id, { id: client.id, name: client.name });
    operations.push({
      id: row.id,
      name: row.name,
      clientId: row.client_id,
    });
    for (const f of row.frentes ?? []) {
      if (f.archived_at !== null) continue;
      frentes.push({
        id: f.id,
        name: f.name,
        operationId: row.id,
      });
    }
  }

  const clients = [...clientsMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
  frentes.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return { clients, operations, frentes };
}