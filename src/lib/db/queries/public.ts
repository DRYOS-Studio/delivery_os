// Queries para a view pública (sem auth). Todas usam createAdmin pra bypassar RLS.
// Filtros explícitos por visibility/archived garantem que só conteúdo apropriado vaza.

import { createAdmin } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type PublicOperationView = {
  id: string;
  name: string;
  clientName: string;
  productLine: Database["public"]["Enums"]["product_line"];
  status: Database["public"]["Enums"]["operation_status"];
  archivedAt: string | null;
  responseHours: number | null;
  resolutionHours: number | null;
  frentes: Array<{
    id: string;
    name: string;
    cycleType: Database["public"]["Enums"]["frente_cycle_type"];
    domain: Database["public"]["Enums"]["frente_domain"];
    phase: Database["public"]["Enums"]["frente_phase"];
    actionableStatus: string;
    actionableStatusSince: string;
  }>;
};

export async function getOperationPublicView(
  operationId: string,
): Promise<PublicOperationView | null> {
  const admin = createAdmin();
  const { data, error } = await admin
    .from("operations")
    .select(
      `
      id, name, product_line, status, archived_at,
      response_hours, resolution_hours,
      client:clients!fk_operations_client_id (name),
      frentes!fk_frentes_operation_id (
        id, name, cycle_type, domain, phase, actionable_status, actionable_status_since, archived_at
      )
      `,
    )
    .eq("id", operationId)
    .maybeSingle();
  if (error) throw new Error(`getOperationPublicView: ${error.message}`);
  if (!data) return null;

  const frentes = (data.frentes ?? [])
    .filter((f) => f.archived_at === null)
    .map((f) => ({
      id: f.id,
      name: f.name,
      cycleType: f.cycle_type,
      domain: f.domain,
      phase: f.phase,
      actionableStatus: f.actionable_status,
      actionableStatusSince: f.actionable_status_since,
    }));

  return {
    id: data.id,
    name: data.name,
    clientName: data.client?.name ?? "—",
    productLine: data.product_line,
    status: data.status,
    archivedAt: data.archived_at,
    responseHours: data.response_hours,
    resolutionHours: data.resolution_hours,
    frentes,
  };
}

export type PublicMeetingItem = {
  id: string;
  title: string;
  scheduledAt: string;
  notes: string | null;
};

export async function listPublicMeetings(
  operationId: string,
): Promise<PublicMeetingItem[]> {
  const admin = createAdmin();
  const { data, error } = await admin
    .from("meetings")
    .select("id, title, scheduled_at, notes")
    .eq("operation_id", operationId)
    .eq("visibility", "cliente")
    .order("scheduled_at", { ascending: false });
  if (error) throw new Error(`listPublicMeetings: ${error.message}`);
  if (!data) return [];
  return data.map((m) => ({
    id: m.id,
    title: m.title,
    scheduledAt: m.scheduled_at,
    notes: m.notes,
  }));
}

export type PublicDecisionItem = {
  id: string;
  title: string;
  decision: string;
  context: string | null;
  decidedAt: string;
};

export async function listPublicDecisions(
  operationId: string,
): Promise<PublicDecisionItem[]> {
  const admin = createAdmin();
  const { data, error } = await admin
    .from("decisions")
    .select("id, title, decision, context, decided_at")
    .eq("operation_id", operationId)
    .eq("visibility", "cliente")
    .order("decided_at", { ascending: false });
  if (error) throw new Error(`listPublicDecisions: ${error.message}`);
  if (!data) return [];
  return data.map((d) => ({
    id: d.id,
    title: d.title,
    decision: d.decision,
    context: d.context,
    decidedAt: d.decided_at,
  }));
}

export type PublicAttachmentItem = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  description: string | null;
  createdAt: string;
};

export async function listPublicAttachments(
  operationId: string,
): Promise<PublicAttachmentItem[]> {
  const admin = createAdmin();
  const { data, error } = await admin
    .from("attachments")
    .select("id, filename, mime_type, size_bytes, description, created_at")
    .eq("operation_id", operationId)
    .is("meeting_id", null)
    // Anexo interno nunca aparece no link público (princípio 05).
    .eq("visibility", "cliente")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listPublicAttachments: ${error.message}`);
  if (!data) return [];
  return data.map((a) => ({
    id: a.id,
    filename: a.filename,
    mimeType: a.mime_type,
    sizeBytes: Number(a.size_bytes),
    description: a.description,
    createdAt: a.created_at,
  }));
}
