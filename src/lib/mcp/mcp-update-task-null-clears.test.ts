import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { mcpUpdateTaskSchema } from "@/lib/mcp/tool-args/task-update";
import { mcpUpdateTask } from "@/lib/mcp/tools/task-tools";

const TASK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("mcpUpdateTaskSchema", () => {
  it("preserva null explícito em sla_incident_id e due_date", () => {
    const parsed = mcpUpdateTaskSchema.safeParse({
      task_id: TASK_ID,
      sla_incident_id: null,
      due_date: null,
      assignee_person_ids: null,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.sla_incident_id).toBeNull();
    expect(parsed.data.due_date).toBeNull();
    expect(parsed.data.assignee_person_ids).toBeNull();
  });

  it("omite campos não enviados", () => {
    const parsed = mcpUpdateTaskSchema.safeParse({ task_id: TASK_ID, title: "Novo título" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.sla_incident_id).toBeUndefined();
    expect(parsed.data.due_date).toBeUndefined();
  });
});

describe("mcpUpdateTask handler", () => {
  it("envia null ao Supabase e remove assignees quando assignee_person_ids é null", async () => {
    const update = vi.fn(() => ({
      eq: () => ({ error: null }),
    }));
    const deleteAssignees = vi.fn(() => ({ eq: () => ({ error: null }) }));
    const selectTasks = vi.fn(() => ({
      eq: () => ({
        maybeSingle: async () => ({ data: { id: TASK_ID }, error: null }),
      }),
    }));

    const supabase = {
      from(table: string) {
        if (table === "tasks") {
          return {
            select: selectTasks,
            update,
          };
        }
        if (table === "task_assignees") {
          return {
            delete: deleteAssignees,
            insert: vi.fn(() => ({ error: null })),
          };
        }
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        };
      },
    } as unknown as SupabaseClient<Database>;

    const result = await mcpUpdateTask(supabase, {
      task_id: TASK_ID,
      sla_incident_id: null,
      due_date: null,
      assignee_person_ids: null,
    });

    expect(result).toEqual({ ok: true, id: TASK_ID });
    expect(update).toHaveBeenCalledWith({
      sla_incident_id: null,
      due_date: null,
    });
    expect(deleteAssignees).toHaveBeenCalled();
  });
});
