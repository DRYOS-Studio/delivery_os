import { createAdmin, createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type IncidentRow = Database["public"]["Tables"]["sla_incidents"]["Row"];

export type IncidentSeverity = Database["public"]["Enums"]["sla_severity"];
export type IncidentStatus = Database["public"]["Enums"]["sla_incident_status"];

export type IncidentListItem = {
  id: string;
  title: string;
  description: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  openedAt: string;
  respondedAt: string | null;
  resolvedAt: string | null;
  openerEmail: string | null;
};

const INCIDENT_FIELDS =
  "id, title, description, severity, status, opened_at, responded_at, resolved_at, opened_by";

async function resolveAuthorEmails(
  ids: ReadonlyArray<string>,
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return new Map();
  const admin = createAdmin();
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (id) => {
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (error || !data?.user?.email) return;
      map.set(id, data.user.email);
    }),
  );
  return map;
}

type RawIncident = {
  id: string;
  title: string;
  description: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  opened_at: string;
  responded_at: string | null;
  resolved_at: string | null;
  opened_by: string | null;
};

function mapWithEmails(
  rows: RawIncident[],
  emails: Map<string, string>,
): IncidentListItem[] {
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    severity: r.severity,
    status: r.status,
    openedAt: r.opened_at,
    respondedAt: r.responded_at,
    resolvedAt: r.resolved_at,
    openerEmail: r.opened_by ? (emails.get(r.opened_by) ?? null) : null,
  }));
}

export async function listIncidentsByOperation(
  operationId: string,
  opts: { excludeCancelled?: boolean } = {},
): Promise<IncidentListItem[]> {
  const supabase = await createServer();
  let query = supabase
    .from("sla_incidents")
    .select(INCIDENT_FIELDS)
    .eq("operation_id", operationId)
    .order("opened_at", { ascending: false });
  if (opts.excludeCancelled) query = query.neq("status", "cancelled");

  const { data, error } = await query;
  if (error) throw new Error(`listIncidentsByOperation: ${error.message}`);
  if (!data) return [];
  const ids = data
    .map((r) => r.opened_by)
    .filter((id): id is string => id !== null);
  const emails = await resolveAuthorEmails(ids);
  return mapWithEmails(data, emails);
}

export async function getIncident(id: string): Promise<IncidentRow | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("sla_incidents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getIncident: ${error.message}`);
  return data;
}

export async function countOpenIncidents(
  operationId: string,
): Promise<number> {
  const supabase = await createServer();
  const { count, error } = await supabase
    .from("sla_incidents")
    .select("id", { count: "exact", head: true })
    .eq("operation_id", operationId)
    .eq("status", "open");
  if (error) throw new Error(`countOpenIncidents: ${error.message}`);
  return count ?? 0;
}

// Public: usa createAdmin (bypassa RLS); exclui cancelled
export async function listPublicIncidents(
  operationId: string,
): Promise<IncidentListItem[]> {
  const admin = createAdmin();
  const { data, error } = await admin
    .from("sla_incidents")
    .select(INCIDENT_FIELDS)
    .eq("operation_id", operationId)
    .neq("status", "cancelled")
    .order("opened_at", { ascending: false });
  if (error) throw new Error(`listPublicIncidents: ${error.message}`);
  if (!data) return [];
  // sem opener email pra view pública
  return mapWithEmails(data, new Map());
}
