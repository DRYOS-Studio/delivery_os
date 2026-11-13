import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type ClientTechItemRow = {
  id: string;
  clientId: string;
  operationId: string | null;
  name: string;
  category: string | null;
  url: string | null;
  notes: string | null;
  sortOrder: number;
};

export type ClientSoftwareItemRow = {
  id: string;
  clientId: string;
  name: string;
  purpose: string | null;
  url: string | null;
  notes: string | null;
  sortOrder: number;
};

export async function listClientTechItems(
  clientId: string,
): Promise<ClientTechItemRow[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("client_tech_items")
    .select("*")
    .eq("client_id", clientId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listClientTechItems: ${error.message}`);
  return (data ?? []).map((row: Database["public"]["Tables"]["client_tech_items"]["Row"]) => ({
    id: row.id,
    clientId: row.client_id,
    operationId: row.operation_id ?? null,
    name: row.name,
    category: row.category,
    url: row.url,
    notes: row.notes,
    sortOrder: row.sort_order,
  }));
}

export async function listClientSoftwareItems(
  clientId: string,
): Promise<ClientSoftwareItemRow[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("client_software_items")
    .select("*")
    .eq("client_id", clientId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listClientSoftwareItems: ${error.message}`);
  return (data ?? []).map((row: Database["public"]["Tables"]["client_software_items"]["Row"]) => ({
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    purpose: row.purpose,
    url: row.url,
    notes: row.notes,
    sortOrder: row.sort_order,
  }));
}
