import { createServer } from "@/lib/db/client";

export type OperationPickItem = {
  id: string;
  name: string;
  clientName: string;
};

export async function listOperationsForAdminInvite(): Promise<OperationPickItem[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("operations")
    .select(
      `
      id, name,
      client:clients!fk_operations_client_id ( name )
      `,
    )
    .is("archived_at", null)
    .order("name", { ascending: true });
  if (error) throw new Error(`listOperationsForAdminInvite: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    clientName: (r.client as { name: string } | null)?.name ?? "—",
  }));
}

export type PersonPickItem = {
  id: string;
  name: string;
  kind: string;
};

export async function listPersonsForAdminLink(): Promise<PersonPickItem[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("persons")
    .select("id, name, kind")
    .is("archived_at", null)
    .order("kind", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(`listPersonsForAdminLink: ${error.message}`);
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
  }));
}
