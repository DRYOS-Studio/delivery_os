import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type ActivitySubjectType =
  Database["public"]["Enums"]["activity_subject_type"];

export type ActivityEventRow = {
  id: string;
  createdAt: string;
  action: string;
  fieldKey: string | null;
  oldValue: unknown;
  newValue: unknown;
  actorName: string | null;
};

type RawEvent = {
  id: string;
  created_at: string;
  action: string;
  field_key: string | null;
  old_value: unknown;
  new_value: unknown;
  actor: { name: string | null } | { name: string | null }[] | null;
};

function pickActor(actor: RawEvent["actor"]): string | null {
  if (!actor) return null;
  return Array.isArray(actor) ? (actor[0]?.name ?? null) : actor.name;
}

function mapRow(r: RawEvent): ActivityEventRow {
  return {
    id: r.id,
    createdAt: r.created_at,
    action: r.action,
    fieldKey: r.field_key,
    oldValue: r.old_value,
    newValue: r.new_value,
    actorName: pickActor(r.actor),
  };
}

const EVENT_SELECT = `
  id, created_at, action, field_key, old_value, new_value,
  actor:profiles!fk_activity_events_actor ( name )
`;

export async function listActivityForTask(
  taskId: string,
  limit = 50,
): Promise<ActivityEventRow[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("activity_events")
    .select(EVENT_SELECT)
    .eq("subject_type", "task")
    .eq("subject_id", taskId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("listActivityForTask", error.message);
    return [];
  }
  return (data as RawEvent[]).map(mapRow);
}

export async function listActivityForOperation(
  operationId: string,
  limit = 80,
): Promise<ActivityEventRow[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("activity_events")
    .select(EVENT_SELECT)
    .eq("operation_id", operationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("listActivityForOperation", error.message);
    return [];
  }
  return (data as RawEvent[]).map(mapRow);
}
