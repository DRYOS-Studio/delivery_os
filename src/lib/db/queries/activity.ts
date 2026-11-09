import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";
import {
  resolveActivityListFilters,
  type ActivityListFilters,
} from "@/lib/utils/activity-filters";

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
  actorProfileId: string | null;
  subjectType: ActivitySubjectType;
  subjectId: string;
  metadata: unknown;
};

type RawEvent = {
  id: string;
  created_at: string;
  action: string;
  field_key: string | null;
  old_value: unknown;
  new_value: unknown;
  subject_type: ActivitySubjectType;
  subject_id: string;
  metadata: unknown;
  actor_profile_id: string | null;
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
    actorProfileId: r.actor_profile_id,
    subjectType: r.subject_type,
    subjectId: r.subject_id,
    metadata: r.metadata,
  };
}

const EVENT_SELECT = `
  id, created_at, action, field_key, old_value, new_value,
  subject_type, subject_id, metadata, actor_profile_id,
  actor:profiles!fk_activity_events_actor ( name )
`;

function appendActivityFilters(
  resolved: ReturnType<typeof resolveActivityListFilters>,
  category: ActivityListFilters["category"],
) {
  return {
    actions: resolved.actions,
    statusFieldOnly: resolved.statusFieldOnly,
    category,
    dateRange: resolved.dateRange,
    offset: resolved.offset,
    limit: resolved.limit,
  };
}

export async function listActivityForTask(
  taskId: string,
  filters: ActivityListFilters = {},
): Promise<ActivityEventRow[]> {
  const supabase = await createServer();
  const resolved = resolveActivityListFilters({
    ...filters,
    limit: filters.limit ?? 50,
  });
  const f = appendActivityFilters(resolved, filters.category);

  let q = supabase
    .from("activity_events")
    .select(EVENT_SELECT)
    .eq("subject_type", "task")
    .eq("subject_id", taskId)
    .order("created_at", { ascending: false });

  if (f.actions) q = q.in("action", [...f.actions]);
  if (f.statusFieldOnly) q = q.eq("field_key", "status");
  else if (f.category === "updated") q = q.neq("field_key", "status");
  if (f.dateRange.createdAfter)
    q = q.gte("created_at", f.dateRange.createdAfter);
  if (f.dateRange.createdBefore)
    q = q.lte("created_at", f.dateRange.createdBefore);

  const { data, error } = await q.range(f.offset, f.offset + f.limit - 1);
  if (error) {
    console.error("listActivityForTask", error.message);
    return [];
  }
  return (data as RawEvent[]).map(mapRow);
}

export async function listActivityForOperation(
  operationId: string,
  filters: ActivityListFilters = {},
): Promise<ActivityEventRow[]> {
  const supabase = await createServer();
  const resolved = resolveActivityListFilters({
    ...filters,
    limit: filters.limit ?? 80,
  });
  const f = appendActivityFilters(resolved, filters.category);

  let q = supabase
    .from("activity_events")
    .select(EVENT_SELECT)
    .eq("operation_id", operationId)
    .order("created_at", { ascending: false });

  if (f.actions) q = q.in("action", [...f.actions]);
  if (f.statusFieldOnly) q = q.eq("field_key", "status");
  else if (f.category === "updated") q = q.neq("field_key", "status");
  if (f.dateRange.createdAfter)
    q = q.gte("created_at", f.dateRange.createdAfter);
  if (f.dateRange.createdBefore)
    q = q.lte("created_at", f.dateRange.createdBefore);

  const { data, error } = await q.range(f.offset, f.offset + f.limit - 1);
  if (error) {
    console.error("listActivityForOperation", error.message);
    return [];
  }
  return (data as RawEvent[]).map(mapRow);
}
