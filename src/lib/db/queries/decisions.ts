import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type DecisionRow = Database["public"]["Tables"]["decisions"]["Row"];

export type DecisionListItem = {
  id: string;
  title: string;
  decision: string;
  context: string | null;
  visibility: Database["public"]["Enums"]["decision_visibility"];
  decidedAt: string;
  meeting: { id: string; title: string; scheduledAt: string } | null;
};

export async function listDecisionsByOperation(
  operationId: string,
  limit = 20,
): Promise<DecisionListItem[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("decisions")
    .select(
      `
      id, title, decision, context, visibility, decided_at,
      meeting:meetings!fk_decisions_meeting_id (id, title, scheduled_at)
      `,
    )
    .eq("operation_id", operationId)
    .order("decided_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listDecisionsByOperation: ${error.message}`);
  if (!data) return [];

  return data.map((d): DecisionListItem => ({
    id: d.id,
    title: d.title,
    decision: d.decision,
    context: d.context,
    visibility: d.visibility,
    decidedAt: d.decided_at,
    meeting: d.meeting
      ? {
          id: d.meeting.id,
          title: d.meeting.title,
          scheduledAt: d.meeting.scheduled_at,
        }
      : null,
  }));
}

// Badge da tab Eventos (op page): count uncapped — a lista acima tem limit 20,
// derivar badge de lista.length flip-flopa quando há >20 registros (#131).
export async function countDecisionsByOperation(
  operationId: string,
): Promise<number> {
  const supabase = await createServer();
  const { count, error } = await supabase
    .from("decisions")
    .select("id", { count: "exact", head: true })
    .eq("operation_id", operationId);
  if (error) throw new Error(`countDecisionsByOperation: ${error.message}`);
  return count ?? 0;
}

export async function getDecision(id: string): Promise<DecisionRow | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("decisions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getDecision: ${error.message}`);
  return data;
}
