import type { Database } from "@/lib/db/types";
import { allocationSchema } from "@/lib/validators/allocation";
import { incidentSchema } from "@/lib/validators/incident";
import { operationCostSchema } from "@/lib/validators/operationCost";
import { quickWinSchema } from "@/lib/validators/quick-win";
import {
  clampLimit,
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

const nextStepArgs = z.object({
  meeting_id: z.string().uuid(),
  description: z.string().trim().min(1).max(2000),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  sort_order: z.number().int().min(0).optional(),
});

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

const costCreate = operationCostSchema.and(z.object({ operation_id: z.string().uuid() }));

export async function mcpCreateOperationCost(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
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
    .select("id, meeting_id, description, due_date, sort_order, task_id")
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
  const id = typeof args.next_step_id === "string" ? args.next_step_id.trim() : "";
  if (!id) return { ok: false, message: "next_step_id obrigatório." };
  const patch: NextStepUpdate = {};
  if (typeof args.description === "string") patch.description = args.description.trim();
  if (typeof args.due_date === "string") patch.due_date = args.due_date;
  if (typeof args.sort_order === "number") patch.sort_order = args.sort_order;
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
