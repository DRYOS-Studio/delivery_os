import { operationNtfyTopicSchema } from "@/lib/validators/operation-ntfy-topic";
import {
  clampLimit,
  mcpRequireAdmin,
  type McpHandlerContext,
  type McpToolResult,
} from "@/lib/mcp/tools/shared";

const SELECT =
  "id, operation_id, topic, label, recovery_tags, default_problem_origin, priority_severity_map, created_at";

export async function mcpListOperationNtfyTopics(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ topics: unknown[] }>> {
  const operationId =
    typeof args.operation_id === "string" ? args.operation_id.trim() : "";
  if (!operationId) return { ok: false, message: "operation_id obrigatório." };
  const limit = clampLimit(args.limit);

  const { data, error } = await ctx.supabase
    .from("operation_ntfy_topics")
    .select(SELECT)
    .eq("operation_id", operationId)
    .order("topic", { ascending: true })
    .limit(limit);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { topics: data ?? [] } };
}

export async function mcpCreateOperationNtfyTopic(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const operationId =
    typeof args.operation_id === "string" ? args.operation_id.trim() : "";
  if (!operationId) return { ok: false, message: "operation_id obrigatório." };

  const { operation_id: _op, idempotency_key: _ik, ...rest } = args;
  const parsed = operationNtfyTopicSchema.safeParse(rest);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }
  const data = parsed.data;
  const { data: row, error } = await ctx.supabase
    .from("operation_ntfy_topics")
    .insert({
      operation_id: operationId,
      topic: data.topic,
      label: data.label ?? null,
      recovery_tags: data.recovery_tags ?? ["resolved", "recovery"],
      default_problem_origin: data.default_problem_origin,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "Tópico já mapeado em outra Operação." };
    }
    return { ok: false, message: error.message };
  }
  if (!row) return { ok: false, message: "Falha ao criar." };
  return { ok: true, data: { id: row.id } };
}

export async function mcpDeleteOperationNtfyTopic(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const topicId =
    typeof args.topic_id === "string" ? args.topic_id.trim() : "";
  const operationId =
    typeof args.operation_id === "string" ? args.operation_id.trim() : "";
  if (!topicId) return { ok: false, message: "topic_id obrigatório." };
  if (!operationId) return { ok: false, message: "operation_id obrigatório." };

  const { error } = await ctx.supabase
    .from("operation_ntfy_topics")
    .delete()
    .eq("id", topicId)
    .eq("operation_id", operationId);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id: topicId } };
}

export async function mcpListNtfyUnmappedAlerts(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ alerts: unknown[] }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;

  const limit = clampLimit(args.limit);
  const { data, error } = await ctx.supabase
    .from("ntfy_unmapped_alerts")
    .select("*")
    .eq("triage_status", "pending")
    .order("received_at", { ascending: false })
    .limit(limit);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { alerts: data ?? [] } };
}
