import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { mcpUpdateMeetingNextStepSchema } from "@/lib/mcp/tool-args/meeting-update";
import { mcpUpdateMeetingNextStep } from "@/lib/mcp/tools/delivery-ops-tools";
import type { McpHandlerContext } from "@/lib/mcp/tools/shared";

const STEP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("mcpUpdateMeetingNextStepSchema", () => {
  it("aceita null para limpar due_date e assignee_person_id", () => {
    const parsed = mcpUpdateMeetingNextStepSchema.safeParse({
      next_step_id: STEP_ID,
      due_date: null,
      assignee_person_id: null,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.due_date).toBeNull();
    expect(parsed.data.assignee_person_id).toBeNull();
  });
});

describe("mcpUpdateMeetingNextStep handler", () => {
  it("persiste null no update", async () => {
    const update = vi.fn(() => ({
      eq: () => ({ error: null }),
    }));
    const supabase = {
      from(table: string) {
        if (table === "meeting_agenda_next_steps") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { meeting_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
                  error: null,
                }),
              }),
            }),
            update,
          };
        }
        if (table === "meetings") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                    operation_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                    auto_create_tasks_from_next_steps: false,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return { select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }) };
      },
    } as unknown as SupabaseClient<Database>;
    const ctx: McpHandlerContext = {
      supabase,
      callerUserId: "11111111-1111-4111-8111-111111111111",
    };
    const result = await mcpUpdateMeetingNextStep(ctx, {
      next_step_id: STEP_ID,
      due_date: null,
      assignee_person_id: null,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe(STEP_ID);
    }
    expect(update).toHaveBeenCalledWith({
      due_date: null,
      assignee_person_id: null,
    });
  });
});
