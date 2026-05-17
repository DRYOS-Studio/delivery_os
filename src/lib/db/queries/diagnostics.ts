import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type DiagnosticRow = Database["public"]["Tables"]["diagnostics"]["Row"];

export type DiagnosticOption = {
  id: string;
  clientId: string;
  label: string;
};

export async function getDiagnosticByClient(
  clientId: string,
): Promise<DiagnosticRow | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("diagnostics")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error(`getDiagnosticByClient: ${error.message}`);
  return data;
}

export async function listDiagnosticsForSelect(): Promise<DiagnosticOption[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("diagnostics")
    .select(
      `
      id, client_id, conducted_at,
      client:clients!fk_diagnostics_client_id (name)
      `,
    );
  if (error) throw new Error(`listDiagnosticsForSelect: ${error.message}`);
  if (!data) return [];
  return data.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    label: r.conducted_at
      ? `${r.client?.name ?? "—"} · ${r.conducted_at}`
      : (r.client?.name ?? "—"),
  }));
}
