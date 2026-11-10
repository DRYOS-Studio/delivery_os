import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type NtfyUnmappedRow =
  Database["public"]["Tables"]["ntfy_unmapped_alerts"]["Row"];

export async function listPendingUnmappedNtfyAlerts(
  limit = 50,
): Promise<NtfyUnmappedRow[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("ntfy_unmapped_alerts")
    .select("*")
    .eq("triage_status", "pending")
    .order("received_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listPendingUnmappedNtfyAlerts: ${error.message}`);
  return data ?? [];
}
