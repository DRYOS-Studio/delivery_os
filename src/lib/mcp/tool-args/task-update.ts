import { taskStatusEnum } from "@/lib/validators/task";
import { z } from "zod";
import {
  mcpClearableDate,
  mcpClearableStringArray,
  mcpClearableText,
  mcpClearableUuid,
  mcpClearableUuidList,
} from "@/lib/mcp/tool-args/clearable";

const taskDateOrderMessage = {
  message: "A data de início não pode ser depois do prazo.",
  path: ["start_date" as const],
};

/** Schema MCP `update_task`: partial com null explícito para limpar FKs/datas/listas. */
export const mcpUpdateTaskSchema = z
  .object({
    task_id: z.string().uuid(),
    title: z.string().trim().min(3).max(200).optional(),
    description: mcpClearableText(5000),
    status: taskStatusEnum.optional(),
    area_id: mcpClearableUuid(),
    parent_task_id: mcpClearableUuid(),
    start_date: mcpClearableDate(),
    due_date: mcpClearableDate(),
    tags: mcpClearableStringArray(),
    quick_win_id: mcpClearableUuid(),
    sla_incident_id: mcpClearableUuid(),
    assignee_person_ids: mcpClearableUuidList(),
    idempotency_key: z.string().min(8).max(200).optional(),
  })
  .refine(
    (d) => {
      if (d.start_date === undefined || d.due_date === undefined) return true;
      if (d.start_date === null || d.due_date === null) return true;
      return d.start_date <= d.due_date;
    },
    taskDateOrderMessage,
  );

export type McpUpdateTaskInput = z.infer<typeof mcpUpdateTaskSchema>;
