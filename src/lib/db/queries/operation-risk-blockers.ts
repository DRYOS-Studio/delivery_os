import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type RiskBlockerRow = Database["public"]["Tables"]["operation_risk_blockers"]["Row"];

export type RiskBlockerListItem = RiskBlockerRow & {
  responsible: { id: string; name: string } | null;
};

export async function listOperationRiskBlockers(
  operationId: string,
  limit = 50,
): Promise<RiskBlockerListItem[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("operation_risk_blockers")
    .select(
      `
      *,
      responsible:persons!fk_operation_risk_blockers_responsible ( id, name )
      `,
    )
    .eq("operation_id", operationId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listOperationRiskBlockers: ${error.message}`);
  return (data ?? []).map((row) => {
    const person = Array.isArray(row.responsible)
      ? (row.responsible[0] ?? null)
      : row.responsible;
    const { responsible: _r, ...rest } = row;
    return { ...rest, responsible: person };
  });
}

export async function countOpenRiskBlockers(operationId: string): Promise<number> {
  const supabase = await createServer();
  const { count, error } = await supabase
    .from("operation_risk_blockers")
    .select("id", { count: "exact", head: true })
    .eq("operation_id", operationId)
    .eq("status", "open");
  if (error) throw new Error(`countOpenRiskBlockers: ${error.message}`);
  return count ?? 0;
}

export async function listRiskBlockersByMeeting(
  meetingId: string,
): Promise<RiskBlockerListItem[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("operation_risk_blockers")
    .select(
      `
      *,
      responsible:persons!fk_operation_risk_blockers_responsible ( id, name )
      `,
    )
    .eq("meeting_id", meetingId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`listRiskBlockersByMeeting: ${error.message}`);
  return (data ?? []).map((row) => {
    const person = Array.isArray(row.responsible)
      ? (row.responsible[0] ?? null)
      : row.responsible;
    const { responsible: _r, ...rest } = row;
    return { ...rest, responsible: person };
  });
}
