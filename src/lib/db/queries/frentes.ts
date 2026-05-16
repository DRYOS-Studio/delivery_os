import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type FrenteRow = Database["public"]["Tables"]["frentes"]["Row"];

export async function getFrente(id: string): Promise<FrenteRow | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("frentes")
    .select("*")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error(`getFrente: ${error.message}`);
  return data;
}

export async function frenteHasActiveAllocations(
  frenteId: string,
): Promise<boolean> {
  const supabase = await createServer();
  const { count, error } = await supabase
    .from("allocations")
    .select("id", { count: "exact", head: true })
    .eq("frente_id", frenteId);
  if (error) throw new Error(`frenteHasActiveAllocations: ${error.message}`);
  return (count ?? 0) > 0;
}
