import { operationRiskBlockerSchema } from "@/lib/validators/operation-risk-blocker";
import { z } from "zod";
import { mcpClearableText, mcpClearableUuid } from "@/lib/mcp/tool-args/clearable";

export const mcpCreateOperationRiskBlockerSchema = operationRiskBlockerSchema.and(
  z.object({ operation_id: z.string().uuid() }),
);

export const mcpUpdateOperationRiskBlockerSchema = z.object({
  risk_blocker_id: z.string().uuid(),
  title: operationRiskBlockerSchema.shape.title.optional(),
  description: mcpClearableText(5000),
  kind: operationRiskBlockerSchema.shape.kind.optional(),
  severity: operationRiskBlockerSchema.shape.severity.optional(),
  status: operationRiskBlockerSchema.shape.status.optional(),
  origin: operationRiskBlockerSchema.shape.origin.optional(),
  responsible_person_id: mcpClearableUuid(),
  meeting_id: mcpClearableUuid(),
  decision_id: mcpClearableUuid(),
  task_id: mcpClearableUuid(),
  idempotency_key: z.string().min(8).max(200).optional(),
});

export const mcpPromoteMeetingNextStepSchema = z.object({
  next_step_id: z.string().uuid(),
  frente_id: z.string().uuid(),
  idempotency_key: z.string().min(8).max(200).optional(),
});
