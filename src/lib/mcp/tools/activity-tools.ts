import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { z } from "zod";
import {
  ACTIVITY_FILTER_CATEGORIES,
  ACTIVITY_DATE_PRESETS,
  type ActivityFilterCategory,
  type ActivityDatePreset,
} from "@/lib/utils/activity-filters";

const listArgs = z
  .object({
    task_id: z.string().uuid().optional(),
    operation_id: z.string().uuid().optional(),
    category: z.enum(ACTIVITY_FILTER_CATEGORIES).optional(),
    date_preset: z.enum(ACTIVITY_DATE_PRESETS).optional(),
    limit: z.number().int().min(1).max(50).optional(),
    offset: z.number().int().min(0).max(10000).optional(),
  })
  .superRefine((d, ctx) => {
    const hasTask = Boolean(d.task_id);
    const hasOp = Boolean(d.operation_id);
    if (hasTask === hasOp) {
      ctx.addIssue({
        code: "custom",
        message: "Informe exatamente um entre task_id ou operation_id.",
      });
    }
  });

const EVENT_SELECT =
  "id, created_at, action, field_key, old_value, new_value, subject_type, subject_id, operation_id, actor_profile_id";

export async function mcpListActivityEvents(
  supabase: SupabaseClient<Database>,
  rawArgs: Record<string, unknown>,
): Promise<
  { ok: true; events: unknown[] } | { ok: false; message: string }
> {
  const parsed = listArgs.safeParse(rawArgs);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Parâmetros inválidos.",
    };
  }

  const a = parsed.data;
  const limit = a.limit ?? 20;
  const offset = a.offset ?? 0;

  let q = supabase
    .from("activity_events")
    .select(EVENT_SELECT)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (a.task_id) {
    q = q.eq("subject_type", "task").eq("subject_id", a.task_id);
  } else if (a.operation_id) {
    q = q.eq("operation_id", a.operation_id);
  }

  const category = (a.category ?? "all") as ActivityFilterCategory;
  if (category === "created") q = q.eq("action", "created");
  if (category === "assignee")
    q = q.in("action", ["assignee_added", "assignee_removed"]);
  if (category === "comments")
    q = q.in("action", [
      "comment_created",
      "comment_updated",
      "comment_deleted",
    ]);
  if (category === "status") {
    q = q.eq("action", "updated").eq("field_key", "status");
  }
  if (category === "updated") {
    q = q.eq("action", "updated").neq("field_key", "status");
  }

  const preset = (a.date_preset ?? "all") as ActivityDatePreset;
  if (preset !== "all") {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);
    if (preset === "today") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (preset === "7d") {
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else if (preset === "30d") {
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
    }
    q = q.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
  }

  const { data, error } = await q;
  if (error) return { ok: false, message: error.message };
  return { ok: true, events: data ?? [] };
}
