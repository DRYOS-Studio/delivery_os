import { meetingSchema } from "@/lib/validators/meeting";
import { z } from "zod";
import {
  mcpClearableDate,
  mcpClearableIsoDateTime,
  mcpClearableText,
  mcpClearableUuid,
} from "@/lib/mcp/tool-args/clearable";

export const mcpAddMeetingNextStepSchema = z.object({
  meeting_id: z.string().uuid(),
  description: z.string().trim().min(1).max(2000),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  sort_order: z.number().int().min(0).optional(),
  assignee_person_id: mcpClearableUuid(),
  task_id: mcpClearableUuid(),
  idempotency_key: z.string().min(8).max(200).optional(),
});

export const mcpUpdateMeetingNextStepSchema = z.object({
  next_step_id: z.string().uuid(),
  description: z.string().trim().min(1).max(2000).optional(),
  due_date: mcpClearableDate(),
  sort_order: z.number().int().min(0).optional(),
  assignee_person_id: mcpClearableUuid(),
  task_id: mcpClearableUuid(),
  idempotency_key: z.string().min(8).max(200).optional(),
});

export const mcpMeetingUpdateBodySchema = z.object({
  meeting_id: z.string().uuid(),
  title: meetingSchema.shape.title.optional(),
  scheduled_at: meetingSchema.shape.scheduled_at.optional(),
  ended_at: mcpClearableIsoDateTime(),
  notes: mcpClearableText(5000),
  visibility: meetingSchema.shape.visibility.optional(),
  kind: meetingSchema.shape.kind.optional(),
  attendee_ids: z.array(z.string().uuid()).optional(),
  granola_suggestion_text: z.union([z.string().max(50_000), z.null()]).optional(),
  granola_source_ref: z.union([z.string().max(500), z.null()]).optional(),
  granola_captured_at: z.union([z.string().datetime(), z.null()]).optional(),
  idempotency_key: z.string().min(8).max(200).optional(),
});
