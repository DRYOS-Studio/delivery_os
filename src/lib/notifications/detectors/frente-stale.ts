import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

const STALE_DAYS_THRESHOLD = 7;
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

export type StaleFrenteToNotify = {
  frente_id: string;
  frente_name: string;
  actionable_status: string;
  stale_days: number;
  operation_id: string;
  operation_name: string;
  client_name: string;
  webhook_url: string;
};

type FrenteRow = {
  id: string;
  name: string;
  actionable_status: string;
  actionable_status_since: string;
  operation:
    | {
        id: string;
        name: string;
        notification_webhook_url: string | null;
        archived_at: string | null;
        client: { name: string } | { name: string }[] | null;
      }
    | {
        id: string;
        name: string;
        notification_webhook_url: string | null;
        archived_at: string | null;
        client: { name: string } | { name: string }[] | null;
      }[]
    | null;
};

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

/**
 * Lista frentes paradas (actionable_status_since > 7 dias) cuja Operação tem
 * webhook configurado e que ainda não foram notificadas nas últimas 24h.
 */
export async function listStaleFrentesPendingNotification(
  supabase: SupabaseClient<Database>,
): Promise<StaleFrenteToNotify[]> {
  const staleThreshold = new Date(
    Date.now() - STALE_DAYS_THRESHOLD * 86_400_000,
  ).toISOString();

  // 1. Carrega frentes stale com op vinculada
  const { data: frentes, error: e1 } = await supabase
    .from("frentes")
    .select(
      `
      id,
      name,
      actionable_status,
      actionable_status_since,
      operation:operations!inner (
        id,
        name,
        notification_webhook_url,
        archived_at,
        client:clients!inner ( name )
      )
    `,
    )
    .is("archived_at", null)
    .lt("actionable_status_since", staleThreshold);

  if (e1) {
    throw new Error(`detector.frente_stale: ${e1.message}`);
  }

  const rows = (frentes ?? []) as unknown as FrenteRow[];

  // 2. Filtra in-memory por Op ativa + URL configurada
  const candidates = rows
    .map((f) => {
      const op = pickOne(f.operation);
      if (!op || op.archived_at !== null) return null;
      if (!op.notification_webhook_url) return null;
      const client = pickOne(op.client);
      if (!client) return null;
      const staleMs = Date.now() - new Date(f.actionable_status_since).getTime();
      const stale_days = Math.floor(staleMs / 86_400_000);
      return {
        frente_id: f.id,
        frente_name: f.name,
        actionable_status: f.actionable_status,
        stale_days,
        operation_id: op.id,
        operation_name: op.name,
        client_name: client.name,
        webhook_url: op.notification_webhook_url,
      };
    })
    .filter((v): v is StaleFrenteToNotify => v !== null);

  if (candidates.length === 0) return [];

  // 3. Filtra os já notificados na janela de dedup
  const dedupSince = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
  const ids = candidates.map((c) => c.frente_id);
  const { data: recent, error: e2 } = await supabase
    .from("notifications_log")
    .select("subject_id")
    .eq("event_type", "frente_stale")
    .in("subject_id", ids)
    .gt("sent_at", dedupSince);

  if (e2) {
    throw new Error(`detector.frente_stale.dedup: ${e2.message}`);
  }

  const blocked = new Set((recent ?? []).map((r) => r.subject_id));
  return candidates.filter((c) => !blocked.has(c.frente_id));
}
