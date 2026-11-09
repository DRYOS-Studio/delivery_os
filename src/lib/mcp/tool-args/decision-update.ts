import { z } from "zod";
import { mcpClearableText, mcpClearableUuid } from "@/lib/mcp/tool-args/clearable";

export const mcpDecisionUpdateSchema = z
  .object({
    decision_id: z.string().uuid(),
    title: z.string().trim().min(3).max(200).optional(),
    context: mcpClearableText(5000),
    decision: z.string().trim().min(3).max(5000).optional(),
    visibility: z.enum(["interno", "cliente"]).optional(),
    decided_at: z.string().min(1).optional(),
    meeting_id: mcpClearableUuid(),
    agenda_item_id: mcpClearableUuid(),
    idempotency_key: z.string().min(8).max(200).optional(),
  })
  .refine(
    (d) => d.agenda_item_id === undefined || d.meeting_id !== undefined,
    {
      message: "Escolha a reunião para vincular um item de pauta.",
      path: ["meeting_id"],
    },
  );
