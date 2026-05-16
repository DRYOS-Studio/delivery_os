import { createServer } from "@/lib/db/client";

export type ExternalPersonItem = {
  id: string;
  name: string;
  email: string | null;
  externalRole: string;
};

export type InternalPersonItem = {
  id: string;
  name: string;
};

export async function listInternalPersons(): Promise<InternalPersonItem[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("persons")
    .select("id, name")
    .eq("kind", "internal")
    .is("archived_at", null)
    .order("name", { ascending: true });
  if (error) throw new Error(`listInternalPersons: ${error.message}`);
  return data ?? [];
}

export async function getExternalPersonsByClient(
  clientId: string,
): Promise<ExternalPersonItem[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("persons")
    .select("id, name, email, external_role")
    .eq("client_id", clientId)
    .eq("kind", "external")
    .is("archived_at", null)
    .order("name", { ascending: true });
  if (error) throw new Error(`getExternalPersonsByClient: ${error.message}`);
  if (!data) return [];
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    externalRole: p.external_role ?? "",
  }));
}
