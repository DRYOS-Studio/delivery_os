import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

export type SlaBreach = {
  kind: "response" | "resolution";
  hoursElapsed: number;
  hoursLimit: number;
};

type IncidentLite = {
  opened_at: string;
  responded_at: string | null;
  resolved_at: string | null;
  status: string;
};

type OperationSlaLite = {
  response_hours: number | null;
  resolution_hours: number | null;
};

/**
 * Detector puro de breach. Retorna o tipo de breach atual (resolution > response
 * em prioridade) ou null se OK. Usa horas inteiras (floor) pra o log.
 */
export function detectSlaBreach(
  incident: IncidentLite,
  operation: OperationSlaLite,
): SlaBreach | null {
  const opened = new Date(incident.opened_at).getTime();
  const elapsedH = (Date.now() - opened) / 3_600_000;

  // Resolução vence depois — checa primeiro
  if (
    incident.status !== "resolved" &&
    incident.status !== "cancelled" &&
    operation.resolution_hours !== null &&
    elapsedH > operation.resolution_hours
  ) {
    return {
      kind: "resolution",
      hoursElapsed: Math.floor(elapsedH),
      hoursLimit: operation.resolution_hours,
    };
  }

  if (
    !incident.responded_at &&
    operation.response_hours !== null &&
    elapsedH > operation.response_hours
  ) {
    return {
      kind: "response",
      hoursElapsed: Math.floor(elapsedH),
      hoursLimit: operation.response_hours,
    };
  }

  return null;
}

export type SlaBreachToNotify = {
  incident_id: string;
  incident_title: string;
  severity: "low" | "medium" | "high";
  breach: SlaBreach;
  operation_id: string;
  operation_name: string;
  client_id: string;
  client_name: string;
  webhook_url: string;
};

type IncidentRow = {
  id: string;
  title: string;
  severity: "low" | "medium" | "high";
  status: string;
  opened_at: string;
  responded_at: string | null;
  resolved_at: string | null;
  operation:
    | {
        id: string;
        name: string;
        response_hours: number | null;
        resolution_hours: number | null;
        notification_webhook_url: string | null;
        archived_at: string | null;
        client: { id: string; name: string } | { id: string; name: string }[] | null;
      }
    | {
        id: string;
        name: string;
        response_hours: number | null;
        resolution_hours: number | null;
        notification_webhook_url: string | null;
        archived_at: string | null;
        client: { id: string; name: string } | { id: string; name: string }[] | null;
      }[]
    | null;
};

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

/**
 * Safety net: lista incidentes abertos (open|responded) em breach que ainda não
 * foram notificados nas últimas 24h. Usado pelo cron.
 */
export async function listOpenSlaIncidentsPendingNotification(
  supabase: SupabaseClient<Database>,
): Promise<SlaBreachToNotify[]> {
  const { data: incidents, error: e1 } = await supabase
    .from("sla_incidents")
    .select(
      `
      id,
      title,
      severity,
      status,
      opened_at,
      responded_at,
      resolved_at,
      operation:operations!inner (
        id,
        name,
        response_hours,
        resolution_hours,
        notification_webhook_url,
        archived_at,
        client:clients!inner ( id, name )
      )
    `,
    )
    .in("status", ["open", "responded"]);

  if (e1) {
    throw new Error(`detector.sla_breach: ${e1.message}`);
  }

  const rows = (incidents ?? []) as unknown as IncidentRow[];

  const candidates: SlaBreachToNotify[] = [];
  for (const r of rows) {
    const op = pickOne(r.operation);
    if (!op || op.archived_at !== null) continue;
    if (!op.notification_webhook_url) continue;
    const client = pickOne(op.client);
    if (!client) continue;
    const breach = detectSlaBreach(r, op);
    if (!breach) continue;
    candidates.push({
      incident_id: r.id,
      incident_title: r.title,
      severity: r.severity,
      breach,
      operation_id: op.id,
      operation_name: op.name,
      client_id: client.id,
      client_name: client.name,
      webhook_url: op.notification_webhook_url,
    });
  }

  if (candidates.length === 0) return [];

  // Dedup
  const dedupSince = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
  const ids = candidates.map((c) => c.incident_id);
  const { data: recent, error: e2 } = await supabase
    .from("notifications_log")
    .select("subject_id")
    .eq("event_type", "sla_breach")
    .in("subject_id", ids)
    .gt("sent_at", dedupSince);

  if (e2) {
    throw new Error(`detector.sla_breach.dedup: ${e2.message}`);
  }

  const blocked = new Set((recent ?? []).map((r) => r.subject_id));
  return candidates.filter((c) => !blocked.has(c.incident_id));
}
