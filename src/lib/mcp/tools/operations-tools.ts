import { getOperationMonthlyCosts } from "@/lib/db/queries/operation-costs";
import { operationCostCategoryLabel } from "@/lib/utils/operation-cost-category";
import { operationSchema } from "@/lib/validators/operation";
import {
  clampLimit,
  mcpCallerIsAdmin,
  mcpRequireAdmin,
  type McpHandlerContext,
  type McpToolResult,
} from "@/lib/mcp/tools/shared";
import { z } from "zod";

const OP_LIST_ADMIN =
  "id, name, status, product_line, client_id, recurrence, monthly_recurring_revenue, start_date, end_date, archived_at, client:clients!fk_operations_client_id ( id, name, slug )";

const OP_LIST_MEMBER =
  "id, name, status, product_line, client_id, start_date, end_date, archived_at, client:clients!fk_operations_client_id ( id, name, slug )";

const OP_DETAIL_ADMIN =
  "id, name, status, product_line, client_id, recurrence, monthly_recurring_revenue, monthly_fixed_cost, tax_rate_pct, start_date, end_date, response_hours, resolution_hours, notification_webhook_url, archived_at, client:clients!fk_operations_client_id ( id, name, slug )";

const OP_DETAIL_MEMBER =
  "id, name, status, product_line, client_id, start_date, end_date, response_hours, resolution_hours, archived_at, client:clients!fk_operations_client_id ( id, name, slug )";

function operationInsert(data: z.infer<typeof operationSchema>) {
  return {
    client_id: data.client_id,
    product_line: data.product_line,
    name: data.name,
    status: data.status,
    recurrence: data.recurrence ?? null,
    monthly_recurring_revenue: data.monthly_recurring_revenue ?? null,
    start_date: data.start_date ?? null,
    end_date: data.end_date ?? null,
    response_hours: data.response_hours ?? null,
    resolution_hours: data.resolution_hours ?? null,
    notification_webhook_url: data.notification_webhook_url ?? null,
  };
}

export async function mcpListOperations(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ operations: unknown[] }>> {
  const limit = clampLimit(args.limit);
  const isAdmin = await mcpCallerIsAdmin(ctx.supabase, ctx.callerUserId);
  const clientId =
    typeof args.client_id === "string" ? args.client_id.trim() : undefined;
  let q = ctx.supabase
    .from("operations")
    .select(isAdmin ? OP_LIST_ADMIN : OP_LIST_MEMBER)
    .is("archived_at", null)
    .order("name", { ascending: true })
    .limit(limit);
  if (clientId) q = q.eq("client_id", clientId);
  const { data, error } = await q;
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { operations: data ?? [] } };
}

export async function mcpGetOperation(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ operation: unknown }>> {
  const opId = typeof args.operation_id === "string" ? args.operation_id.trim() : "";
  if (!opId) return { ok: false, message: "operation_id obrigatório." };
  const isAdmin = await mcpCallerIsAdmin(ctx.supabase, ctx.callerUserId);
  const fetched = isAdmin
    ? await ctx.supabase
        .from("operations")
        .select(OP_DETAIL_ADMIN)
        .eq("id", opId)
        .maybeSingle()
    : await ctx.supabase
        .from("operations")
        .select(OP_DETAIL_MEMBER)
        .eq("id", opId)
        .maybeSingle();
  const { data, error } = fetched;
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Operação não encontrada.", notFound: true };
  if (!isAdmin) {
    return { ok: true, data: { operation: data as unknown as Record<string, unknown> } };
  }
  const breakdown = await getOperationMonthlyCosts(opId, ctx.supabase);
  const adminRow = data as unknown as Record<string, unknown> & {
    monthly_fixed_cost?: number | null;
  };
  return {
    ok: true,
    data: {
      operation: {
        ...adminRow,
        monthly_fixed_cost_legacy: adminRow.monthly_fixed_cost,
        operation_costs: breakdown.adHocItems.map((c) => ({
          id: c.id,
          category: c.category,
          category_label: operationCostCategoryLabel(c.category),
          label: c.label,
          amount: c.amount,
          recurrence: c.recurrence,
          started_at: c.startedAt,
          ended_at: c.endedAt,
          notes: c.notes,
        })),
        monthly_cost_category_subtotals: breakdown.categorySubtotals,
        monthly_costs_total: breakdown.adHocMonthly,
        monthly_costs_breakdown_total: breakdown.totalMonthly,
      },
    },
  };
}

const createOpArgs = operationSchema;

export async function mcpCreateOperation(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const parsed = createOpArgs.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { data, error } = await ctx.supabase
    .from("operations")
    .insert(operationInsert(parsed.data))
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Falha ao criar." };
  return { ok: true, data };
}

export async function mcpUpdateOperation(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const opId = typeof args.operation_id === "string" ? args.operation_id.trim() : "";
  if (!opId) return { ok: false, message: "operation_id obrigatório." };
  const { operation_id: _o, idempotency_key: _ik, ...rest } = args;
  const parsed = createOpArgs.safeParse(rest);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const insertShape = operationInsert(parsed.data);
  const { error } = await ctx.supabase
    .from("operations")
    .update(insertShape)
    .eq("id", opId);
  if (error) return { ok: false, message: error.message };
  if (
    parsed.data.notification_webhook_url !== undefined &&
    parsed.data.notification_webhook_url !== null
  ) {
  const { data: opRow } = await ctx.supabase
      .from("operations")
      .select("client_id")
      .eq("id", opId)
      .maybeSingle();
    if (opRow?.client_id) {
      const url = (parsed.data.notification_webhook_url ?? "").trim();
      if (url.length > 0) {
        const { data: existing } = await ctx.supabase
          .from("client_tech_items")
          .select("id")
          .eq("operation_id", opId)
          .eq("category", "n8n_webhook")
          .maybeSingle();
        if (existing?.id) {
          await ctx.supabase
            .from("client_tech_items")
            .update({ url, client_id: opRow.client_id })
            .eq("id", existing.id);
        } else {
          await ctx.supabase.from("client_tech_items").insert({
            client_id: opRow.client_id,
            operation_id: opId,
            name: "Webhook n8n",
            category: "n8n_webhook",
            url,
            sort_order: -100,
          });
        }
      }
    }
  }
  return { ok: true, data: { id: opId } };
}

export async function mcpArchiveOperation(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const opId = typeof args.operation_id === "string" ? args.operation_id.trim() : "";
  if (!opId) return { ok: false, message: "operation_id obrigatório." };
  if (args.confirm !== true) {
    return {
      ok: false,
      message: "Arquivar operação exige confirm: true (status terminal + cascata).",
    };
  }
  const { error } = await ctx.supabase.rpc("archive_operation_cascade", {
    p_operation_id: opId,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id: opId } };
}

const memberArgs = z.object({
  operation_id: z.string().uuid(),
  profile_id: z.string().uuid(),
});

export async function mcpListOperationMembers(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ members: unknown[] }>> {
  const parsed = z.object({ operation_id: z.string().uuid() }).safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "operation_id inválido." };
  }
  const { data: rows, error } = await ctx.supabase
    .from("operation_members")
    .select("profile_id, created_at")
    .eq("operation_id", parsed.data.operation_id);
  if (error) return { ok: false, message: error.message };
  const profileIds = [...new Set((rows ?? []).map((r) => r.profile_id))];
  const profileById = new Map<string, { id: string; role: string }>();
  if (profileIds.length > 0) {
    const { data: profiles, error: pErr } = await ctx.supabase
      .from("profiles")
      .select("id, role")
      .in("id", profileIds);
    if (pErr) return { ok: false, message: pErr.message };
    for (const p of profiles ?? []) {
      profileById.set(p.id, { id: p.id, role: p.role });
    }
  }
  const members = (rows ?? []).map((r) => ({
    profile_id: r.profile_id,
    created_at: r.created_at,
    profile: profileById.get(r.profile_id) ?? null,
  }));
  return { ok: true, data: { members } };
}

export async function mcpAddOperationMember(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ operation_id: string; profile_id: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const parsed = memberArgs.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { error } = await ctx.supabase.from("operation_members").insert({
    operation_id: parsed.data.operation_id,
    profile_id: parsed.data.profile_id,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, message: "Membro já vinculado." };
    return { ok: false, message: error.message };
  }
  return { ok: true, data: parsed.data };
}

export async function mcpRemoveOperationMember(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ operation_id: string; profile_id: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const parsed = memberArgs.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { error } = await ctx.supabase
    .from("operation_members")
    .delete()
    .eq("operation_id", parsed.data.operation_id)
    .eq("profile_id", parsed.data.profile_id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: parsed.data };
}
