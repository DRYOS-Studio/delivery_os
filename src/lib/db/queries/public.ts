// Queries para a view pública (sem auth). Todas usam createAdmin pra bypassar RLS.
// Filtros explícitos por visibility/archived garantem que só conteúdo apropriado vaza.

import { operationCatalogLineLabel } from "@/lib/catalog/operation-catalog-group";
import { createAdmin } from "@/lib/db/client";
import { withCatalogGroupSelectFallback } from "@/lib/db/queries/operation-catalog-fallback";
import type { Database } from "@/lib/db/types";

export type PublicOperationView = {
  id: string;
  name: string;
  clientName: string;
  catalogLineLabel: string;
  status: Database["public"]["Enums"]["operation_status"];
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

const OPERATION_PUBLIC_VIEW_SELECT = `
      id, name, catalog_group, product_line, status,
      response_hours, resolution_hours,
      client:clients!fk_operations_client_id (name),
      frentes!fk_frentes_operation_id (
        id, name, cycle_type, domain, phase, actionable_status, actionable_status_since, archived_at
      )
      `;

export async function getOperationPublicView(
  operationId: string,
): Promise<PublicOperationView | null> {
  const admin = createAdmin();
  const { data, error } = await withCatalogGroupSelectFallback(
    OPERATION_PUBLIC_VIEW_SELECT,
    async (select) =>
      await admin.from("operations").select(select).eq("id", operationId).maybeSingle(),
  );
  if (error) throw new Error(`getOperationPublicView: ${error.message}`);
  if (!data) return null;

  type PublicRow = {
    id: string;
    name: string;
    catalog_group?: Database["public"]["Tables"]["operations"]["Row"]["catalog_group"];
    product_line: Database["public"]["Tables"]["operations"]["Row"]["product_line"];
    status: PublicOperationView["status"];
    response_hours: number | null;
    resolution_hours: number | null;
    client: { name: string } | null;
    frentes:
      | Array<{
          id: string;
          name: string;
          cycle_type: Database["public"]["Enums"]["frente_cycle_type"];
          domain: Database["public"]["Enums"]["frente_domain"];
          phase: Database["public"]["Enums"]["frente_phase"];
          actionable_status: string;
          actionable_status_since: string;
          archived_at: string | null;
        }>
      | null;
  };
  const row = data as unknown as PublicRow;

  const frentes = (row.frentes ?? [])
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
    id: row.id,
    name: row.name,
    clientName: row.client?.name ?? "—",
    catalogLineLabel: operationCatalogLineLabel(
      row.catalog_group,
      row.product_line,
    ),
    status: row.status,
    // archived_at deliberadamente FORA do view: operação arquivada nunca chega
    // aqui — o resolver do token já retornou null (não reintroduzir o vazamento).
    responseHours: row.response_hours,
    resolutionHours: row.resolution_hours,
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
