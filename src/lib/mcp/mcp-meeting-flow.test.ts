import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { mcpCreateOperationRiskBlockerSchema } from "@/lib/mcp/tool-args/operation-risk-blocker-update";
import { mcpPromoteMeetingNextStepToTask } from "@/lib/mcp/tools/delivery-ops-tools";
import type { McpHandlerContext } from "@/lib/mcp/tools/shared";

describe("mcpCreateOperationRiskBlockerSchema", () => {
  it("aceita registro mínimo", () => {
    const parsed = mcpCreateOperationRiskBlockerSchema.safeParse({
      operation_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      title: "Instabilidade ERP",
      kind: "risk",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("mcpPromoteMeetingNextStepToTask", () => {
  it("cria tarefa com source_meeting_id e vincula next step", async () => {
    const insertTask = vi.fn(() => ({
      select: () => ({
        single: async () => ({ data: { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }, error: null }),
      }),
    }));
    const updateStep = vi.fn(() => ({ eq: () => ({ error: null }) }));

    const supabase = {
      from(table: string) {
        if (table === "meeting_agenda_next_steps") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                    description: "Enviar planilha",
                    due_date: null,
                    task_id: null,
                    assignee_person_id: null,
                    meeting: { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", operation_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
                  },
                  error: null,
                }),
              }),
            }),
            update: updateStep,
          };
        }
        if (table === "frentes") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", operation_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", archived_at: null },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "tasks") return { insert: insertTask };
        return { insert: vi.fn() };
      },
    } as unknown as SupabaseClient<Database>;

    const ctx: McpHandlerContext = { supabase, callerUserId: "11111111-1111-4111-8111-111111111111" };
    const r = await mcpPromoteMeetingNextStepToTask(ctx, {
      next_step_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      frente_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    });
    expect(r.ok).toBe(true);
    expect(insertTask).toHaveBeenCalledWith(
      expect.objectContaining({
        source_meeting_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      }),
    );
    expect(updateStep).toHaveBeenCalled();
  });
});
