import type { Database, Json } from "@/lib/db/types";
import { syncAutoTasksForMeeting } from "@/lib/meetings/meeting-next-step-tasks";
import { calendarDateLocalToday } from "@/lib/utils/calendar-date";
import { assignVillainSchema, editOperationVillainSchema } from "@/lib/validators/operation-villain";

type MeetingUpdate = Database["public"]["Tables"]["meetings"]["Update"];
import { diagnosticSchema } from "@/lib/validators/diagnostic";
import { mcpDecisionUpdateSchema } from "@/lib/mcp/tool-args/decision-update";
import { decisionSchema } from "@/lib/validators/decision";
import { applyClearable } from "@/lib/mcp/tool-args/clearable";
import { mcpMeetingUpdateBodySchema } from "@/lib/mcp/tool-args/meeting-update";
import { meetingSchema } from "@/lib/validators/meeting";
import { managementDiagnosticSaveSchema } from "@/lib/validators/management-diagnostic";
import { personSchema } from "@/lib/validators/person";
import {
  computeDiagnosticScores,
  deriveActionPlan,
  detectDiagnosticFlags,
} from "@/lib/utils/management-diagnostic";
import {
  mcpRequireAdmin,
  type McpHandlerContext,
  type McpToolResult,
} from "@/lib/mcp/tools/shared";
import { z } from "zod";

const commentBody = z.string().trim().min(1).max(8000);

export async function mcpGetPerson(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ person: unknown }>> {
  const id = typeof args.person_id === "string" ? args.person_id.trim() : "";
  if (!id) return { ok: false, message: "person_id obrigatório." };
  const { data, error } = await ctx.supabase
    .from("persons")
    .select(
      "id, name, kind, email, specialty, external_role, client_id, hourly_rate, monthly_compensation, contracted_weekly_hours, archived_at, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Pessoa não encontrada.", notFound: true };
  return { ok: true, data: { person: data } };
}

export async function mcpUpdatePerson(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const id = typeof args.person_id === "string" ? args.person_id.trim() : "";
  if (!id) return { ok: false, message: "person_id obrigatório." };
  const { person_id: _p, idempotency_key: _ik, ...rest } = args;
  const parsed = personSchema.safeParse(rest);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const p = parsed.data;
  const row =
    p.kind === "internal"
      ? {
          kind: "internal" as const,
          name: p.name,
          email: p.email ?? null,
          specialty: p.specialty,
          external_role: null,
          client_id: null,
          hourly_rate: p.hourly_rate ?? null,
          monthly_compensation: p.monthly_compensation ?? null,
          contracted_weekly_hours: null,
        }
      : {
          kind: "external" as const,
          name: p.name,
          email: p.email ?? null,
          specialty: null,
          external_role: p.external_role,
          client_id: p.client_id,
          hourly_rate: null,
          monthly_compensation: null,
          contracted_weekly_hours: p.contracted_weekly_hours ?? null,
        };
  const { error } = await ctx.supabase.from("persons").update(row).eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id } };
}

export async function mcpArchivePerson(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const id = typeof args.person_id === "string" ? args.person_id.trim() : "";
  if (!id) return { ok: false, message: "person_id obrigatório." };
  const { error } = await ctx.supabase
    .from("persons")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id } };
}

const MEETING_SELECT =
  "id, operation_id, title, scheduled_at, ended_at, visibility, notes, granola_suggestion_text, granola_source_ref, granola_captured_at, created_at, updated_at";

export async function mcpGetMeeting(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ meeting: unknown; attendees: unknown[] }>> {
  const id = typeof args.meeting_id === "string" ? args.meeting_id.trim() : "";
  if (!id) return { ok: false, message: "meeting_id obrigatório." };
  const { data, error } = await ctx.supabase
    .from("meetings")
    .select(MEETING_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Reunião não encontrada.", notFound: true };
  const { data: attendees, error: aErr } = await ctx.supabase
    .from("meeting_attendees")
    .select("person_id, person:persons!fk_meeting_attendees_person_id ( id, name )")
    .eq("meeting_id", id);
  if (aErr) return { ok: false, message: aErr.message };
  return { ok: true, data: { meeting: data, attendees: attendees ?? [] } };
}

export async function mcpUpdateMeeting(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<
  McpToolResult<{
    id: string;
    tasks_created?: number;
    warnings?: unknown[];
  }>
> {
  const { idempotency_key: _ik, ...rest } = args;
  void _ik;
  const parsed = mcpMeetingUpdateBodySchema.safeParse(rest);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const {
    meeting_id,
    attendee_ids,
    next_steps: nextSteps,
    auto_create_tasks_from_next_steps: autoTasks,
    ...fields
  } = parsed.data;
  const patch: MeetingUpdate = {};
  if (fields.title !== undefined) patch.title = fields.title;
  if (fields.scheduled_at !== undefined) patch.scheduled_at = fields.scheduled_at;
  if (fields.visibility !== undefined) patch.visibility = fields.visibility;
  if (fields.kind !== undefined) patch.kind = fields.kind;
  applyClearable(patch, "ended_at", fields.ended_at);
  applyClearable(
    patch,
    "notes",
    fields.notes === undefined
      ? undefined
      : fields.notes === null
        ? null
        : fields.notes.trim() || null,
  );
  if (fields.granola_suggestion_text !== undefined) {
    const v = fields.granola_suggestion_text;
    patch.granola_suggestion_text =
      v === null ? null : v.trim() || null;
  }
  if (fields.granola_source_ref !== undefined) {
    const v = fields.granola_source_ref;
    patch.granola_source_ref = v === null ? null : v.trim() || null;
  }
  if (autoTasks !== undefined) {
    patch.auto_create_tasks_from_next_steps = autoTasks;
  }
  if (fields.granola_captured_at !== undefined) {
    patch.granola_captured_at = fields.granola_captured_at;
  } else if (
    fields.granola_suggestion_text !== undefined &&
    fields.granola_suggestion_text !== null &&
    fields.granola_suggestion_text
  ) {
    patch.granola_captured_at = new Date().toISOString();
  }
  if (
    Object.keys(patch).length === 0 &&
    attendee_ids === undefined &&
    nextSteps === undefined
  ) {
    return { ok: false, message: "Nada para atualizar." };
  }
  if (Object.keys(patch).length > 0) {
    const { error } = await ctx.supabase.from("meetings").update(patch).eq("id", meeting_id);
    if (error) return { ok: false, message: error.message };
  }
  if (attendee_ids !== undefined) {
    await ctx.supabase.from("meeting_attendees").delete().eq("meeting_id", meeting_id);
    if (attendee_ids.length > 0) {
      const { error: insErr } = await ctx.supabase.from("meeting_attendees").insert(
        attendee_ids.map((person_id) => ({ meeting_id, person_id })),
      );
      if (insErr) return { ok: false, message: insErr.message };
    }
  }
  if (nextSteps !== undefined) {
    const { data: existing, error: exErr } = await ctx.supabase
      .from("meeting_agenda_next_steps")
      .select("id, task_id")
      .eq("meeting_id", meeting_id);
    if (exErr) return { ok: false, message: exErr.message };
    const removable = (existing ?? []).filter((r) => !r.task_id);
    if (removable.length > 0) {
      const { error: delErr } = await ctx.supabase
        .from("meeting_agenda_next_steps")
        .delete()
        .in(
          "id",
          removable.map((r) => r.id),
        );
      if (delErr) return { ok: false, message: delErr.message };
    }
    if (nextSteps.length > 0) {
      const { error: insErr } = await ctx.supabase
        .from("meeting_agenda_next_steps")
        .insert(
          nextSteps.map((row, idx) => ({
            meeting_id,
            sort_order: row.sort_order ?? idx,
            description: row.description,
            due_date: row.due_date ?? null,
            assignee_person_id: row.assignee_person_id ?? null,
            frente_id: row.frente_id ?? null,
            task_id: null,
          })),
        );
      if (insErr) return { ok: false, message: insErr.message };
    }
  }
  const sync = await syncAutoTasksForMeeting(ctx.supabase, meeting_id);
  return {
    ok: true,
    data: {
      id: meeting_id,
      tasks_created: sync.createdTaskIds.length,
      warnings: sync.warnings,
    },
  };
}

export async function mcpGetDecision(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ decision: unknown }>> {
  const id = typeof args.decision_id === "string" ? args.decision_id.trim() : "";
  if (!id) return { ok: false, message: "decision_id obrigatório." };
  const { data, error } = await ctx.supabase
    .from("decisions")
    .select(
      "id, operation_id, title, context, decision, visibility, decided_at, meeting_id, agenda_item_id, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Decisão não encontrada.", notFound: true };
  return { ok: true, data: { decision: data } };
}

export async function mcpUpdateDecision(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const { operation_id: _o, ...restIn } = args;
  void _o;
  const parsed = mcpDecisionUpdateSchema.safeParse(restIn);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { decision_id: id, idempotency_key: _ik, ...rest } = parsed.data;
  void _ik;
  const patch: Database["public"]["Tables"]["decisions"]["Update"] = {};
  if (rest.title !== undefined) patch.title = rest.title;
  if (rest.decision !== undefined) patch.decision = rest.decision;
  if (rest.visibility !== undefined) patch.visibility = rest.visibility;
  if (rest.decided_at !== undefined) patch.decided_at = rest.decided_at;
  applyClearable(patch, "context", rest.context);
  applyClearable(patch, "meeting_id", rest.meeting_id);
  applyClearable(patch, "agenda_item_id", rest.agenda_item_id);
  if (Object.keys(patch).length === 0) {
    return { ok: false, message: "Nada para atualizar." };
  }
  const { error } = await ctx.supabase.from("decisions").update(patch).eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id } };
}

export async function mcpListOperationComments(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ comments: unknown[] }>> {
  const opId = typeof args.operation_id === "string" ? args.operation_id.trim() : "";
  if (!opId) return { ok: false, message: "operation_id obrigatório." };
  const { data, error } = await ctx.supabase
    .from("operation_comments")
    .select("id, operation_id, body, author_profile_id, created_at, updated_at")
    .eq("operation_id", opId)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { comments: data ?? [] } };
}

export async function mcpAddOperationComment(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const opId = typeof args.operation_id === "string" ? args.operation_id.trim() : "";
  const body = typeof args.body === "string" ? args.body : "";
  const parsed = z.object({ body: commentBody }).safeParse({ body });
  if (!opId) return { ok: false, message: "operation_id obrigatório." };
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "body inválido." };
  }
  const { data, error } = await ctx.supabase
    .from("operation_comments")
    .insert({
      operation_id: opId,
      body: parsed.data.body,
      author_profile_id: ctx.callerUserId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Falha ao comentar." };
  return { ok: true, data: { id: data.id } };
}

export async function mcpUpdateOperationComment(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const id = typeof args.comment_id === "string" ? args.comment_id.trim() : "";
  const body = typeof args.body === "string" ? args.body : "";
  const parsed = z.object({ body: commentBody }).safeParse({ body });
  if (!id) return { ok: false, message: "comment_id obrigatório." };
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "body inválido." };
  }
  const { error } = await ctx.supabase
    .from("operation_comments")
    .update({ body: parsed.data.body })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id } };
}

export async function mcpAssignOperationVillain(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const opId = typeof args.operation_id === "string" ? args.operation_id.trim() : "";
  if (!opId) return { ok: false, message: "operation_id obrigatório." };
  const parsed = assignVillainSchema.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const d = parsed.data;
  const { data, error } = await ctx.supabase
    .from("operation_villains")
    .insert({
      operation_id: opId,
      villain_id: d.villain_id,
      initial_severity: d.initial_severity,
      progress_pct: d.progress_pct,
      evidence: d.evidence ?? null,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, message: "Vilão já atribuído a esta operação." };
    return { ok: false, message: error.message };
  }
  if (!data) return { ok: false, message: "Falha ao atribuir." };
  return { ok: true, data: { id: data.id } };
}

export async function mcpUpdateOperationVillain(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const id = typeof args.operation_villain_id === "string" ? args.operation_villain_id.trim() : "";
  if (!id) return { ok: false, message: "operation_villain_id obrigatório." };
  const parsed = editOperationVillainSchema.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { error } = await ctx.supabase
    .from("operation_villains")
    .update({ evidence: parsed.data.evidence ?? null })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id } };
}

const DIAG_SELECT =
  "id, client_id, notes, recommended_product, conducted_at, form_type, status, profile_data, answers, na_answers, computed_scores, flags, action_plan, version, created_at, updated_at";

export async function mcpGetClientDiagnostic(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ diagnostic: unknown }>> {
  const clientId = typeof args.client_id === "string" ? args.client_id.trim() : "";
  if (!clientId) return { ok: false, message: "client_id obrigatório." };
  const { data, error } = await ctx.supabase
    .from("diagnostics")
    .select(DIAG_SELECT)
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { diagnostic: data ?? null } };
}

export async function mcpUpsertClientDiagnostic(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string; client_id: string }>> {
  const clientId = typeof args.client_id === "string" ? args.client_id.trim() : "";
  if (!clientId) return { ok: false, message: "client_id obrigatório." };
  const { client_id: _c, idempotency_key: _ik, ...rest } = args;
  const parsed = diagnosticSchema.safeParse(rest);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const d = parsed.data;
  const patch = {
    notes: d.notes,
    recommended_product: d.recommended_product ?? null,
    conducted_at: d.conducted_at ?? null,
  };
  const { data: existing } = await ctx.supabase
    .from("diagnostics")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();
  if (existing?.id) {
    const { error } = await ctx.supabase.from("diagnostics").update(patch).eq("id", existing.id);
    if (error) return { ok: false, message: error.message };
    return { ok: true, data: { id: existing.id, client_id: clientId } };
  }
  const { data, error } = await ctx.supabase
    .from("diagnostics")
    .insert({ client_id: clientId, ...patch })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Falha ao criar." };
  return { ok: true, data: { id: data.id, client_id: clientId } };
}

export async function mcpSaveManagementDiagnostic(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string; client_id: string }>> {
  const clientId = typeof args.client_id === "string" ? args.client_id.trim() : "";
  const diagnosticId =
    typeof args.diagnostic_id === "string" ? args.diagnostic_id.trim() : undefined;
  if (!clientId) return { ok: false, message: "client_id obrigatório." };
  const { client_id: _c, diagnostic_id: _d, idempotency_key: _ik, ...rest } = args;
  void _c;
  void _d;
  void _ik;
  const parsed = managementDiagnosticSaveSchema.safeParse(rest);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const data = parsed.data;
  const computedScores = computeDiagnosticScores(data.answers, data.naAnswers);
  const flags = detectDiagnosticFlags(data.answers, data.naAnswers);
  const actionPlan = deriveActionPlan(computedScores.dims);
  const conductedAt =
    data.conductedAt ||
    (data.profileData.data ? data.profileData.data : calendarDateLocalToday());
  const payload = {
    client_id: clientId,
    form_type: data.formType,
    status: data.status,
    conducted_at: conductedAt,
    notes: data.notes || null,
    recommended_product: data.recommendedProduct ?? null,
    profile_data: data.profileData as unknown as Json,
    answers: data.answers as unknown as Json,
    na_answers: data.naAnswers as unknown as Json,
    computed_scores: computedScores as unknown as Json,
    flags: flags as unknown as Json,
    action_plan: actionPlan as unknown as Json,
    version: 1,
  };
  if (diagnosticId) {
    const { error } = await ctx.supabase.from("diagnostics").update(payload).eq("id", diagnosticId);
    if (error) return { ok: false, message: error.message };
    return { ok: true, data: { id: diagnosticId, client_id: clientId } };
  }
  const { data: inserted, error } = await ctx.supabase
    .from("diagnostics")
    .insert(payload)
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  if (!inserted) return { ok: false, message: "Falha ao salvar." };
  return { ok: true, data: { id: inserted.id, client_id: clientId } };
}
