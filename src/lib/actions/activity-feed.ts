"use server";

import {
  listActivityForOperation,
  listActivityForTask,
  type ActivityEventRow,
} from "@/lib/db/queries/activity";
import {
  buildActivityFormatContext,
  type ActivityResolveMaps,
} from "@/lib/db/queries/activity-resolve";
import type { ActivityFormatContext } from "@/lib/utils/activity-format";
import type { ActivityListFilters } from "@/lib/utils/activity-filters";
import { createServer } from "@/lib/db/client";
import { err, ok, type ActionResult } from "@/lib/actions/_types";

export type ActivityFeedScope =
  | { kind: "task"; taskId: string }
  | { kind: "operation"; operationId: string };

export type ActivityFeedPayload = {
  events: ActivityEventRow[];
  context: ActivityFormatContext;
};

function mapToRecord(m: Map<string, string>): Record<string, string> {
  return Object.fromEntries(m);
}

function serializeContext(ctx: ActivityResolveMaps): ActivityFormatContext {
  return {
    persons: mapToRecord(ctx.persons),
    frentes: mapToRecord(ctx.frentes),
    operations: mapToRecord(ctx.operations),
    clients: mapToRecord(ctx.clients),
    areas: mapToRecord(ctx.areas),
    profileNames: mapToRecord(ctx.profileNames),
  };
}

async function assertCanLoadScope(scope: ActivityFeedScope): Promise<boolean> {
  const supabase = await createServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  if (scope.kind === "task") {
    const { data } = await supabase
      .from("tasks")
      .select("id")
      .eq("id", scope.taskId)
      .maybeSingle();
    return Boolean(data);
  }

  const { data } = await supabase
    .from("operations")
    .select("id")
    .eq("id", scope.operationId)
    .maybeSingle();
  return Boolean(data);
}

export async function fetchActivityFeedAction(
  scope: ActivityFeedScope,
  filters: ActivityListFilters,
): Promise<ActionResult<ActivityFeedPayload>> {
  const allowed = await assertCanLoadScope(scope);
  if (!allowed) return err("Sem permissão para ver este histórico.", "forbidden");

  const events =
    scope.kind === "task"
      ? await listActivityForTask(scope.taskId, filters)
      : await listActivityForOperation(scope.operationId, filters);

  const context = await buildActivityFormatContext(events);

  return ok({
    events,
    context: serializeContext(context),
  });
}
