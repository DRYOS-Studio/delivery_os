import type { Database } from "@/lib/db/types";
import { applyClearable } from "@/lib/mcp/tool-args/clearable";
import {
  mcpAddMeetingNextStepSchema,
  mcpUpdateMeetingNextStepSchema,
} from "@/lib/mcp/tool-args/meeting-update";
import {
  mcpCreateOperationRiskBlockerSchema,
  mcpPromoteMeetingNextStepSchema,
  mcpUpdateOperationRiskBlockerSchema,
} from "@/lib/mcp/tool-args/operation-risk-blocker-update";
import { getOperationMonthlyCosts } from "@/lib/db/queries/operation-costs";
import { allocationSchema } from "@/lib/validators/allocation";
import { incidentSchema } from "@/lib/validators/incident";
import { operationCostSchema } from "@/lib/validators/operationCost";
import { quickWinSchema } from "@/lib/validators/quick-win";
import { computeMargin } from "@/lib/utils/margin";
import {
  clampLimit,
  mcpRequireAdmin,
  type McpHandlerContext,
  type McpToolResult,
} from "@/lib/mcp/tools/shared";
import { z } from "zod";

type AgendaItemUpdate = Database["public"]["Tables"]["meeting_agenda_items"]["Update"];
type NextStepUpdate = Database["public"]["Tables"]["meeting_agenda_next_steps"]["Update"];

const agendaItemArgs = z.object({
  meeting_id: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
  notes: z.string().max(5000).optional(),
  sort_order: z.number().int().min(0).optional(),
});

const nextStepArgs = mcpAddMeetingNextStepSchema;

export async function mcpListAllocations(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ allocations: unknown[] }>> {
  const frenteId = typeof args.frente_id === "string" ? args.frente_id.trim() : "";
  if (!frenteId) return { ok: false, message: "frente_id obrigatório." };
  const { data, error } = await ctx.supabase
    .from("allocations")
    .select(
      "id, person_id, frente_id, role, capacity_weekly_pct, weekly_hours, monthly_cost, start_date, end_date, person:persons!fk_allocations_person_id ( id, name )",
    )
    .eq("frente_id", frenteId)
    .order("start_date", { ascending: false });
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { allocations: data ?? [] } };
}

const createAlloc = allocationSchema.and(z.object({ frente_id: z.string().uuid() }));

export async function mcpCreateAllocation(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const parsed = createAlloc.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { frente_id, ...a } = parsed.data;
  const { data, error } = await ctx.supabase
    .from("allocations")
    .insert({
      frente_id,
      person_id: a.person_id,
      role: a.role,
      capacity_weekly_pct: a.capacity_weekly_pct ?? 0,
      weekly_hours: a.weekly_hours ?? null,
      monthly_cost: a.monthly_cost ?? null,
      start_date: a.start_date,
      end_date: a.end_date ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Falha ao criar." };
  return { ok: true, data: { id: data.id } };
}

export async function mcpUpdateAllocation(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const allocId = typeof args.allocation_id === "string" ? args.allocation_id.trim() : "";
  if (!allocId) return { ok: false, message: "allocation_id obrigatório." };
  const { allocation_id: _a, frente_id: _f, idempotency_key: _ik, ...rest } = args;
  const parsed = allocationSchema.safeParse(rest);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const a = parsed.data;
  const { error } = await ctx.supabase
    .from("allocations")
    .update({
      person_id: a.person_id,
      role: a.role,
      capacity_weekly_pct: a.capacity_weekly_pct ?? 0,
      weekly_hours: a.weekly_hours ?? null,
      monthly_cost: a.monthly_cost ?? null,
      start_date: a.start_date,
      end_date: a.end_date ?? null,
    })
    .eq("id", allocId);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id: allocId } };
}

export async function mcpGetAllocation(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ allocation: unknown }>> {
  const id = typeof args.allocation_id === "string" ? args.allocation_id.trim() : "";
  if (!id) return { ok: false, message: "allocation_id obrigatório." };
  const { data, error } = await ctx.supabase
    .from("allocations")
    .select(
      "id, person_id, frente_id, role, capacity_weekly_pct, weekly_hours, monthly_cost, start_date, end_date",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Alocação não encontrada.", notFound: true };
  return { ok: true, data: { allocation: data } };
}

export async function mcpEndAllocation(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const id = typeof args.allocation_id === "string" ? args.allocation_id.trim() : "";
  const endDate = typeof args.end_date === "string" ? args.end_date.trim() : "";
  if (!id || !endDate) return { ok: false, message: "allocation_id e end_date obrigatórios." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return { ok: false, message: "end_date inválida (YYYY-MM-DD)." };
  }
  const { error } = await ctx.supabase.from("allocations").update({ end_date: endDate }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id } };
}

export async function mcpListQuickWins(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ quick_wins: unknown[] }>> {
  const opId = typeof args.operation_id === "string" ? args.operation_id.trim() : "";
  if (!opId) return { ok: false, message: "operation_id obrigatório." };
  const { data, error } = await ctx.supabase
    .from("quick_wins")
    .select("id, operation_id, frente_id, title, happened_at, description, created_at")
    .eq("operation_id", opId)
    .order("happened_at", { ascending: false })
    .limit(clampLimit(args.limit, 50, 100));
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { quick_wins: data ?? [] } };
}

const qwCreate = quickWinSchema.and(z.object({ operation_id: z.string().uuid() }));

export async function mcpCreateQuickWin(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const parsed = qwCreate.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { operation_id, impacts, ...q } = parsed.data;
  const { data, error } = await ctx.supabase
    .from("quick_wins")
    .insert({
      operation_id,
      frente_id: q.frente_id ?? null,
      executor_id: ctx.callerUserId,
      title: q.title,
      description: q.description ?? null,
      happened_at: q.happened_at,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Falha ao criar." };
  for (const imp of impacts) {
    const { error: iErr } = await ctx.supabase.from("quick_win_impacts").insert({
      quick_win_id: data.id,
      operation_villain_id: imp.operation_villain_id,
      impact_pct: imp.impact_pct,
    });
    if (iErr) return { ok: false, message: iErr.message };
  }
  return { ok: true, data: { id: data.id } };
}

export async function mcpGetQuickWin(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ quick_win: unknown; impacts: unknown[] }>> {
  const id = typeof args.quick_win_id === "string" ? args.quick_win_id.trim() : "";
  if (!id) return { ok: false, message: "quick_win_id obrigatório." };
  const { data, error } = await ctx.supabase
    .from("quick_wins")
    .select("id, operation_id, frente_id, title, description, happened_at, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Quick win não encontrado.", notFound: true };
  const { data: impacts, error: iErr } = await ctx.supabase
    .from("quick_win_impacts")
    .select("id, operation_villain_id, impact_pct")
    .eq("quick_win_id", id);
  if (iErr) return { ok: false, message: iErr.message };
  return { ok: true, data: { quick_win: data, impacts: impacts ?? [] } };
}

export async function mcpUpdateQuickWin(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const id = typeof args.quick_win_id === "string" ? args.quick_win_id.trim() : "";
  if (!id) return { ok: false, message: "quick_win_id obrigatório." };
  const { quick_win_id: _q, operation_id: _o, idempotency_key: _ik, ...rest } = args;
  const parsed = quickWinSchema.safeParse(rest);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const q = parsed.data;
  const { error: upErr } = await ctx.supabase
    .from("quick_wins")
    .update({
      frente_id: q.frente_id ?? null,
      title: q.title,
      description: q.description ?? null,
      happened_at: q.happened_at,
    })
    .eq("id", id);
  if (upErr) return { ok: false, message: upErr.message };
  const { error: delErr } = await ctx.supabase.from("quick_win_impacts").delete().eq("quick_win_id", id);
  if (delErr) return { ok: false, message: delErr.message };
  for (const imp of q.impacts) {
    const { error: iErr } = await ctx.supabase.from("quick_win_impacts").insert({
      quick_win_id: id,
      operation_villain_id: imp.operation_villain_id,
      impact_pct: imp.impact_pct,
    });
    if (iErr) return { ok: false, message: iErr.message };
  }
  return { ok: true, data: { id } };
}

export async function mcpListSlaIncidents(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ incidents: unknown[] }>> {
  const opId = typeof args.operation_id === "string" ? args.operation_id.trim() : "";
  if (!opId) return { ok: false, message: "operation_id obrigatório." };
  const { data, error } = await ctx.supabase
    .from("sla_incidents")
    .select("id, operation_id, title, severity, status, opened_at, responded_at, resolved_at")
    .eq("operation_id", opId)
    .order("opened_at", { ascending: false })
    .limit(clampLimit(args.limit));
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { incidents: data ?? [] } };
}

const incCreate = incidentSchema.and(z.object({ operation_id: z.string().uuid() }));

export async function mcpCreateSlaIncident(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const parsed = incCreate.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { operation_id, ...i } = parsed.data;
  const { data, error } = await ctx.supabase
    .from("sla_incidents")
    .insert({
      operation_id,
      title: i.title,
      description: i.description ?? null,
      severity: i.severity,
      status: i.status,
      opened_at: i.opened_at,
      responded_at: i.responded_at ?? null,
      resolved_at: i.resolved_at ?? null,
      opened_by: ctx.callerUserId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Falha ao criar." };
  return { ok: true, data: { id: data.id } };
}

export async function mcpUpdateSlaIncident(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const id = typeof args.incident_id === "string" ? args.incident_id.trim() : "";
  if (!id) return { ok: false, message: "incident_id obrigatório." };
  const { incident_id: _i, operation_id: _o, idempotency_key: _ik, ...rest } = args;
  const parsed = incidentSchema.safeParse(rest);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const i = parsed.data;
  const { error } = await ctx.supabase
    .from("sla_incidents")
    .update({
      title: i.title,
      description: i.description ?? null,
      severity: i.severity,
      status: i.status,
      opened_at: i.opened_at,
      responded_at: i.responded_at ?? null,
      resolved_at: i.resolved_at ?? null,
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id } };
}

export async function mcpListOperationCosts(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ costs: unknown[] }>> {
  const opId = typeof args.operation_id === "string" ? args.operation_id.trim() : "";
  if (!opId) return { ok: false, message: "operation_id obrigatório." };
  const { data, error } = await ctx.supabase
    .from("operation_costs")
    .select("id, operation_id, label, amount, recurrence, started_at, ended_at, notes")
    .eq("operation_id", opId)
    .order("started_at", { ascending: false });
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { costs: data ?? [] } };
}

export async function mcpGetOperationMonthlyCosts(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<
  McpToolResult<{
    breakdown: {
      fixed_cost: number;
      ad_hoc_monthly: number;
      ad_hoc_once_total: number;
      allocations_total: number;
      tax_rate_pct: number | null;
      tax_monthly_amount: number;
      total_monthly: number;
    };
    margin: {
      mrr: number | null;
      value: number;
      pct: number | null;
    };
  }>
> {
  const opId = typeof args.operation_id === "string" ? args.operation_id.trim() : "";
  if (!opId) return { ok: false, message: "operation_id obrigatório." };
  try {
    const breakdown = await getOperationMonthlyCosts(opId, ctx.supabase);
    const { data: opRow, error: opErr } = await ctx.supabase
      .from("operations")
      .select("monthly_recurring_revenue")
      .eq("id", opId)
      .maybeSingle();
    if (opErr) return { ok: false, message: opErr.message };
    if (!opRow) {
      return {
        ok: false,
        message: "Operação não encontrada.",
        notFound: true,
      };
    }
    const mrr =
      opRow.monthly_recurring_revenue === null ||
      opRow.monthly_recurring_revenue === undefined
        ? null
        : Number(opRow.monthly_recurring_revenue);
    const margin = computeMargin(mrr, breakdown.totalMonthly);
    return {
      ok: true,
      data: {
        breakdown: {
          fixed_cost: breakdown.fixedCost,
          ad_hoc_monthly: breakdown.adHocMonthly,
          ad_hoc_once_total: breakdown.adHocOnceTotal,
          allocations_total: breakdown.allocationsTotal,
          tax_rate_pct: breakdown.taxRatePct,
          tax_monthly_amount: breakdown.taxMonthlyAmount,
          total_monthly: breakdown.totalMonthly,
        },
        margin: {
          mrr,
          value: margin.value,
          pct: margin.pct,
        },
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao calcular custos.";
    return { ok: false, message };
  }
}

const costCreate = operationCostSchema.and(z.object({ operation_id: z.string().uuid() }));

export async function mcpCreateOperationCost(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const parsed = costCreate.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { operation_id, ...c } = parsed.data;
  const { data, error } = await ctx.supabase
    .from("operation_costs")
    .insert({
      operation_id,
      label: c.label,
      amount: c.amount,
      recurrence: c.recurrence,
      started_at: c.started_at,
      ended_at: c.ended_at ?? null,
      notes: c.notes ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Falha ao criar." };
  return { ok: true, data: { id: data.id } };
}

export async function mcpUpdateOperationCost(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const id = typeof args.cost_id === "string" ? args.cost_id.trim() : "";
  if (!id) return { ok: false, message: "cost_id obrigatório." };
  const { cost_id: _c, operation_id: _o, idempotency_key: _ik, ...rest } = args;
  const parsed = operationCostSchema.safeParse(rest);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const c = parsed.data;
  const { error } = await ctx.supabase
    .from("operation_costs")
    .update({
      label: c.label,
      amount: c.amount,
      recurrence: c.recurrence,
      started_at: c.started_at,
      ended_at: c.ended_at ?? null,
      notes: c.notes ?? null,
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id } };
}

export async function mcpEndOperationCost(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const id = typeof args.cost_id === "string" ? args.cost_id.trim() : "";
  const endedAt = typeof args.ended_at === "string" ? args.ended_at.trim() : "";
  if (!id || !endedAt) return { ok: false, message: "cost_id e ended_at obrigatórios." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endedAt)) {
    return { ok: false, message: "ended_at inválida (YYYY-MM-DD)." };
  }
  const { error } = await ctx.supabase.from("operation_costs").update({ ended_at: endedAt }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id } };
}

export async function mcpListMeetingAgendaItems(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ items: unknown[] }>> {
  const meetingId = typeof args.meeting_id === "string" ? args.meeting_id.trim() : "";
  if (!meetingId) return { ok: false, message: "meeting_id obrigatório." };
  const { data, error } = await ctx.supabase
    .from("meeting_agenda_items")
    .select("id, meeting_id, title, notes, sort_order, source")
    .eq("meeting_id", meetingId)
    .order("sort_order", { ascending: true });
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { items: data ?? [] } };
}

export async function mcpAddMeetingAgendaItem(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const parsed = agendaItemArgs.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { data, error } = await ctx.supabase
    .from("meeting_agenda_items")
    .insert({
      meeting_id: parsed.data.meeting_id,
      title: parsed.data.title,
      notes: parsed.data.notes ?? null,
      sort_order: parsed.data.sort_order ?? 0,
      source: "manual",
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Falha ao criar." };
  return { ok: true, data: { id: data.id } };
}

export async function mcpUpdateMeetingAgendaItem(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const id = typeof args.agenda_item_id === "string" ? args.agenda_item_id.trim() : "";
  if (!id) return { ok: false, message: "agenda_item_id obrigatório." };
  const title = typeof args.title === "string" ? args.title.trim() : undefined;
  const notes = typeof args.notes === "string" ? args.notes : undefined;
  const sort = typeof args.sort_order === "number" ? args.sort_order : undefined;
  const patch: AgendaItemUpdate = {};
  if (title) patch.title = title;
  if (notes !== undefined) patch.notes = notes;
  if (sort !== undefined) patch.sort_order = sort;
  if (Object.keys(patch).length === 0) return { ok: false, message: "Nada para atualizar." };
  const { error } = await ctx.supabase.from("meeting_agenda_items").update(patch).eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id } };
}

export async function mcpListMeetingNextSteps(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ next_steps: unknown[] }>> {
  const meetingId = typeof args.meeting_id === "string" ? args.meeting_id.trim() : "";
  if (!meetingId) return { ok: false, message: "meeting_id obrigatório." };
  const { data, error } = await ctx.supabase
    .from("meeting_agenda_next_steps")
    .select(
      "id, meeting_id, description, due_date, sort_order, task_id, assignee_person_id",
    )
    .eq("meeting_id", meetingId)
    .order("sort_order", { ascending: true });
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { next_steps: data ?? [] } };
}

export async function mcpAddMeetingNextStep(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const parsed = nextStepArgs.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { data, error } = await ctx.supabase
    .from("meeting_agenda_next_steps")
    .insert({
      meeting_id: parsed.data.meeting_id,
      description: parsed.data.description,
      due_date: parsed.data.due_date ?? null,
      sort_order: parsed.data.sort_order ?? 0,
      assignee_person_id: parsed.data.assignee_person_id ?? null,
      task_id: parsed.data.task_id ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Falha ao criar." };
  return { ok: true, data: { id: data.id } };
}

export async function mcpUpdateMeetingNextStep(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const parsed = mcpUpdateMeetingNextStepSchema.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { next_step_id: id, idempotency_key: _ik, ...rest } = parsed.data;
  void _ik;
  const patch: NextStepUpdate = {};
  if (rest.description !== undefined) patch.description = rest.description;
  if (rest.sort_order !== undefined) patch.sort_order = rest.sort_order;
  applyClearable(patch, "due_date", rest.due_date);
  applyClearable(patch, "assignee_person_id", rest.assignee_person_id);
  applyClearable(patch, "task_id", rest.task_id);
  if (Object.keys(patch).length === 0) return { ok: false, message: "Nada para atualizar." };
  const { error } = await ctx.supabase.from("meeting_agenda_next_steps").update(patch).eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id } };
}

export async function mcpListOperationVillains(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ villains: unknown[] }>> {
  const opId = typeof args.operation_id === "string" ? args.operation_id.trim() : "";
  if (!opId) return { ok: false, message: "operation_id obrigatório." };
  const { data, error } = await ctx.supabase
    .from("operation_villains")
    .select("id, operation_id, villain_id, initial_severity, progress_pct, evidence")
    .eq("operation_id", opId);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { villains: data ?? [] } };
}

export async function mcpListOperationRiskBlockers(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ items: unknown[] }>> {
  const opId = typeof args.operation_id === "string" ? args.operation_id.trim() : "";
  if (!opId) return { ok: false, message: "operation_id obrigatório." };
  const { data, error } = await ctx.supabase
    .from("operation_risk_blockers")
    .select(
      "id, operation_id, title, description, kind, severity, status, origin, responsible_person_id, meeting_id, decision_id, task_id, created_at, updated_at",
    )
    .eq("operation_id", opId)
    .order("updated_at", { ascending: false })
    .limit(clampLimit(args.limit));
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { items: data ?? [] } };
}

export async function mcpCreateOperationRiskBlocker(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const parsed = mcpCreateOperationRiskBlockerSchema.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { operation_id, ...row } = parsed.data;
  const { data, error } = await ctx.supabase
    .from("operation_risk_blockers")
    .insert({
      operation_id,
      title: row.title,
      description: row.description ?? null,
      kind: row.kind,
      severity: row.severity,
      status: row.status,
      origin: row.origin,
      responsible_person_id: row.responsible_person_id ?? null,
      meeting_id: row.meeting_id ?? null,
      decision_id: row.decision_id ?? null,
      task_id: row.task_id ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Falha ao criar." };
  return { ok: true, data: { id: data.id } };
}

export async function mcpUpdateOperationRiskBlocker(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const parsed = mcpUpdateOperationRiskBlockerSchema.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { risk_blocker_id: id, ...rest } = parsed.data;
  const patch: Database["public"]["Tables"]["operation_risk_blockers"]["Update"] =
    {};
  if (rest.title !== undefined) patch.title = rest.title;
  applyClearable(
    patch,
    "description",
    rest.description === undefined
      ? undefined
      : rest.description === null
        ? null
        : rest.description.trim() || null,
  );
  if (rest.kind !== undefined) patch.kind = rest.kind;
  if (rest.severity !== undefined) patch.severity = rest.severity;
  if (rest.status !== undefined) patch.status = rest.status;
  if (rest.origin !== undefined) patch.origin = rest.origin;
  applyClearable(patch, "responsible_person_id", rest.responsible_person_id);
  applyClearable(patch, "meeting_id", rest.meeting_id);
  applyClearable(patch, "decision_id", rest.decision_id);
  applyClearable(patch, "task_id", rest.task_id);
  if (Object.keys(patch).length === 0) {
    return { ok: false, message: "Nada para atualizar." };
  }
  const { error } = await ctx.supabase
    .from("operation_risk_blockers")
    .update(patch)
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id } };
}

export async function mcpPromoteMeetingNextStepToTask(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ task_id: string; next_step_id: string }>> {
  const parsed = mcpPromoteMeetingNextStepSchema.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { next_step_id: nextStepId, frente_id: frenteId } = parsed.data;
  const { data: step, error: stepErr } = await ctx.supabase
    .from("meeting_agenda_next_steps")
    .select(
      "id, description, due_date, task_id, assignee_person_id, meeting:meetings!fk_meeting_agenda_next_steps_meeting ( id, operation_id )",
    )
    .eq("id", nextStepId)
    .maybeSingle();
  if (stepErr) return { ok: false, message: stepErr.message };
  if (!step) return { ok: false, message: "Próximo passo não encontrado.", notFound: true };
  if (step.task_id) return { ok: false, message: "Este passo já virou tarefa." };
  const meeting = step.meeting as { id: string; operation_id: string } | null;
  if (!meeting?.operation_id) {
    return { ok: false, message: "Reunião inválida." };
  }
  const { data: frente, error: fErr } = await ctx.supabase
    .from("frentes")
    .select("id, operation_id, archived_at")
    .eq("id", frenteId)
    .maybeSingle();
  if (fErr) return { ok: false, message: fErr.message };
  if (!frente || frente.archived_at) {
    return { ok: false, message: "Frente não encontrada ou arquivada." };
  }
  if (frente.operation_id !== meeting.operation_id) {
    return { ok: false, message: "Frente não pertence à operação." };
  }
  const description = step.description;
  const { data: taskRow, error: insErr } = await ctx.supabase
    .from("tasks")
    .insert({
      frente_id: frenteId,
      operation_id: meeting.operation_id,
      title: description.slice(0, 200),
      description: description.length > 200 ? description : null,
      status: "todo",
      due_date: step.due_date,
      source_meeting_id: meeting.id,
    })
    .select("id")
    .single();
  if (insErr) return { ok: false, message: insErr.message };
  if (!taskRow) return { ok: false, message: "Falha ao criar tarefa." };
  if (step.assignee_person_id) {
    const { error: aErr } = await ctx.supabase.from("task_assignees").insert({
      task_id: taskRow.id,
      person_id: step.assignee_person_id,
    });
    if (aErr) return { ok: false, message: aErr.message };
  }
  const { error: linkErr } = await ctx.supabase
    .from("meeting_agenda_next_steps")
    .update({ task_id: taskRow.id })
    .eq("id", nextStepId);
  if (linkErr) return { ok: false, message: linkErr.message };
  return {
    ok: true,
    data: { task_id: taskRow.id, next_step_id: nextStepId },
  };
}
