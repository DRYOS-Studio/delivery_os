import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { OPEN_STATUSES } from "@/lib/db/queries/tasks";
import { detectSlaBreach } from "@/lib/notifications/detectors/sla-breach";
import {
  type DailyDigestData,
  DAILY_DIGEST_DUE_SOON_DAYS,
  DAILY_DIGEST_STALE_DAYS,
} from "@/lib/notifications/digest-types";
import { resolveGlobalDigestWebhook } from "@/lib/notifications/webhook-resolve";

const DIGEST_SUBJECT_ID = "00000000-0000-0000-0000-000000000001";
const STALE_DAYS_THRESHOLD = DAILY_DIGEST_STALE_DAYS;
const DUE_SOON_DAYS = DAILY_DIGEST_DUE_SOON_DAYS;

/** Data civil (YYYY-MM-DD) em America/Sao_Paulo — alinhada a `due_date` (date). */
export function todayIsoDateSP(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function addDaysIso(base: string, days: number): string {
  const parts = base.split("-").map((p) => Number(p));
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

type OpJoin = {
  id: string;
  name: string;
  archived_at: string | null;
  client: { id: string; name: string } | { id: string; name: string }[] | null;
};

type OpJoinWithSla = OpJoin & {
  response_hours: number | null;
  resolution_hours: number | null;
};

type TaskRow = {
  id: string;
  title: string;
  due_date: string | null;
  operation_id: string;
  operation: OpJoin | OpJoin[] | null;
};

type FrenteRow = {
  id: string;
  name: string;
  actionable_status: string;
  actionable_status_since: string;
  operation: OpJoin | OpJoin[] | null;
};

type IncidentRow = {
  id: string;
  title: string;
  severity: "low" | "medium" | "high";
  status: string;
  opened_at: string;
  responded_at: string | null;
  resolved_at: string | null;
  operation: OpJoinWithSla | OpJoinWithSla[] | null;
};

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

/**
 * Verifica se já enviamos o digest nas últimas ~20h (dedup por `subject_id` fixo).
 */
export async function dailyDigestAlreadySent(
  supabase: SupabaseClient<Database>,
  windowMs: number = 20 * 60 * 60 * 1000,
): Promise<boolean> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const { data, error } = await supabase
    .from("notifications_log")
    .select("id")
    .eq("event_type", "daily_digest")
    .eq("subject_id", DIGEST_SUBJECT_ID)
    .gt("sent_at", since)
    .limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
}

export async function collectDailyDigest(
  supabase: SupabaseClient<Database>,
): Promise<DailyDigestData> {
  const today = todayIsoDateSP();
  const dueLimit = addDaysIso(today, DUE_SOON_DAYS);
  const staleThreshold = new Date(
    Date.now() - STALE_DAYS_THRESHOLD * 86_400_000,
  ).toISOString();

  const [tasksRes, frentesRes, incidentsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        `
        id, title, due_date, operation_id,
        operation:operations!inner (
          id, name, archived_at,
          client:clients!inner ( id, name )
        )
      `,
      )
      .in("status", OPEN_STATUSES)
      .is("area_id", null)
      .not("due_date", "is", null)
      .lte("due_date", dueLimit),
    supabase
      .from("frentes")
      .select(
        `
        id, name, actionable_status, actionable_status_since,
        operation:operations!inner (
          id, name, archived_at,
          client:clients!inner ( id, name )
        )
      `,
      )
      .is("archived_at", null)
      .lt("actionable_status_since", staleThreshold),
    supabase
      .from("sla_incidents")
      .select(
        `
        id, title, severity, status,
        opened_at, responded_at, resolved_at,
        operation:operations!inner (
          id, name, archived_at,
          response_hours, resolution_hours,
          client:clients!inner ( id, name )
        )
      `,
      )
      .in("status", ["open", "responded"]),
  ]);

  if (tasksRes.error) throw new Error(`daily_digest.tasks: ${tasksRes.error.message}`);
  if (frentesRes.error) {
    throw new Error(`daily_digest.frentes: ${frentesRes.error.message}`);
  }
  if (incidentsRes.error) {
    throw new Error(`daily_digest.incidents: ${incidentsRes.error.message}`);
  }

  const taskRows = (tasksRes.data ?? []) as unknown as TaskRow[];
  const frenteRows = (frentesRes.data ?? []) as unknown as FrenteRow[];
  const incidentRows = (incidentsRes.data ?? []) as unknown as IncidentRow[];

  const tasksOverdueRaw = taskRows.filter((t) => t.due_date && t.due_date < today);
  const tasksDueSoonRaw = taskRows.filter(
    (t) => t.due_date && t.due_date >= today && t.due_date <= dueLimit,
  );

  const staleFrentesRaw = frenteRows
    .map((f) => {
      const op = pickOne(f.operation);
      if (!op || op.archived_at !== null) return null;
      const client = pickOne(op.client);
      if (!client) return null;
      const staleMs =
        Date.now() - new Date(f.actionable_status_since).getTime();
      const stale_days = Math.floor(staleMs / 86_400_000);
      return {
        frente_id: f.id,
        frente_name: f.name,
        actionable_status: f.actionable_status,
        stale_days,
        operation_id: op.id,
        operation_name: op.name,
        client_id: client.id,
        client_name: client.name,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  const slaRaw: Array<{
    incident_id: string;
    incident_title: string;
    severity: string;
    operation_id: string;
    operation_name: string;
    client_id: string;
    client_name: string;
    breach: NonNullable<ReturnType<typeof detectSlaBreach>>;
  }> = [];

  for (const r of incidentRows) {
    const op = pickOne(r.operation);
    if (!op || op.archived_at !== null) continue;
    const client = pickOne(op.client);
    if (!client) continue;
    const breach = detectSlaBreach(r, op);
    if (!breach) continue;
    slaRaw.push({
      incident_id: r.id,
      incident_title: r.title,
      severity: r.severity,
      operation_id: op.id,
      operation_name: op.name,
      client_id: client.id,
      client_name: client.name,
      breach,
    });
  }

  type ClientBucket = {
    client: { id: string; name: string };
    operations: Map<
      string,
      {
        operation: { id: string; name: string };
        tasks_overdue: Map<string, { id: string; title: string; due_date: string | null }>;
        tasks_due_soon: Map<string, { id: string; title: string; due_date: string | null }>;
        frentes_stale: Map<
          string,
          { id: string; name: string; actionable_status: string; stale_days: number }
        >;
        sla_incidents: Map<
          string,
          {
            id: string;
            title: string;
            severity: string;
            breach_kind: "response" | "resolution";
            hours_elapsed: number;
            hours_limit: number;
          }
        >;
      }
    >;
  };

  const byClient = new Map<string, ClientBucket>();

  function ensureOp(
    clientId: string,
    clientName: string,
    operationId: string,
    operationName: string,
  ) {
    let cb = byClient.get(clientId);
    if (!cb) {
      cb = { client: { id: clientId, name: clientName }, operations: new Map() };
      byClient.set(clientId, cb);
    }
    let ob = cb.operations.get(operationId);
    if (!ob) {
      ob = {
        operation: { id: operationId, name: operationName },
        tasks_overdue: new Map(),
        tasks_due_soon: new Map(),
        frentes_stale: new Map(),
        sla_incidents: new Map(),
      };
      cb.operations.set(operationId, ob);
    }
    return ob;
  }

  for (const t of tasksOverdueRaw) {
    const op = pickOne(t.operation);
    if (!op || op.archived_at !== null) continue;
    const c = pickOne(op.client);
    if (!c) continue;
    const bucket = ensureOp(c.id, c.name, op.id, op.name);
    bucket.tasks_overdue.set(t.id, {
      id: t.id,
      title: t.title,
      due_date: t.due_date,
    });
  }
  for (const t of tasksDueSoonRaw) {
    const op = pickOne(t.operation);
    if (!op || op.archived_at !== null) continue;
    const c = pickOne(op.client);
    if (!c) continue;
    const bucket = ensureOp(c.id, c.name, op.id, op.name);
    bucket.tasks_due_soon.set(t.id, {
      id: t.id,
      title: t.title,
      due_date: t.due_date,
    });
  }
  for (const f of staleFrentesRaw) {
    const bucket = ensureOp(
      f.client_id,
      f.client_name,
      f.operation_id,
      f.operation_name,
    );
    bucket.frentes_stale.set(f.frente_id, {
      id: f.frente_id,
      name: f.frente_name,
      actionable_status: f.actionable_status,
      stale_days: f.stale_days,
    });
  }
  for (const s of slaRaw) {
    const bucket = ensureOp(
      s.client_id,
      s.client_name,
      s.operation_id,
      s.operation_name,
    );
    bucket.sla_incidents.set(s.incident_id, {
      id: s.incident_id,
      title: s.incident_title,
      severity: s.severity,
      breach_kind: s.breach.kind,
      hours_elapsed: s.breach.hoursElapsed,
      hours_limit: s.breach.hoursLimit,
    });
  }

  const clients: DailyDigestData["clients"] = [];
  for (const cb of byClient.values()) {
    const operations: DailyDigestData["clients"][number]["operations"] = [];
    for (const ob of cb.operations.values()) {
      const hasAny =
        ob.tasks_overdue.size > 0 ||
        ob.tasks_due_soon.size > 0 ||
        ob.frentes_stale.size > 0 ||
        ob.sla_incidents.size > 0;
      if (!hasAny) continue;
      operations.push({
        operation: ob.operation,
        tasks_overdue: [...ob.tasks_overdue.values()],
        tasks_due_soon: [...ob.tasks_due_soon.values()],
        frentes_stale: [...ob.frentes_stale.values()],
        sla_incidents: [...ob.sla_incidents.values()],
      });
    }
    if (operations.length === 0) continue;
    clients.push({
      client: cb.client,
      operations,
    });
  }

  clients.sort((a, b) => a.client.name.localeCompare(b.client.name, "pt-BR"));

  return {
    generated_at: new Date().toISOString(),
    summary: {
      tasks_overdue: tasksOverdueRaw.length,
      tasks_due_soon: tasksDueSoonRaw.length,
      frentes_stale: staleFrentesRaw.length,
      sla_breaches: slaRaw.length,
    },
    clients,
  };
}

export function getDigestSubjectId(): string {
  return DIGEST_SUBJECT_ID;
}

export function hasDigestContent(data: DailyDigestData): boolean {
  return data.clients.length > 0;
}
