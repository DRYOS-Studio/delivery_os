import { briefingSchema } from "@/lib/validators/briefing";
import { decisionSchema } from "@/lib/validators/decision";
import { meetingSchema } from "@/lib/validators/meeting";
import { personSchema } from "@/lib/validators/person";
import {
  clampLimit,
  type McpHandlerContext,
  type McpToolResult,
} from "@/lib/mcp/tools/shared";
import { z } from "zod";

export async function mcpListPersons(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ persons: unknown[] }>> {
  const limit = clampLimit(args.limit);
  const clientId =
    typeof args.client_id === "string" ? args.client_id.trim() : undefined;
  let q = ctx.supabase
    .from("persons")
    .select(
      "id, name, kind, email, specialty, external_role, client_id, archived_at",
    )
    .is("archived_at", null)
    .order("name", { ascending: true })
    .limit(limit);
  if (clientId) q = q.eq("client_id", clientId);
  const { data, error } = await q;
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { persons: data ?? [] } };
}

export async function mcpCreatePerson(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const parsed = personSchema.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const p = parsed.data;
  const { data, error } =
    p.kind === "internal"
      ? await ctx.supabase
          .from("persons")
          .insert({
            kind: "internal",
            name: p.name,
            email: p.email ?? null,
            specialty: p.specialty,
            external_role: null,
            client_id: null,
            hourly_rate: p.hourly_rate ?? null,
            monthly_compensation: p.monthly_compensation ?? null,
          })
          .select("id")
          .single()
      : await ctx.supabase
          .from("persons")
          .insert({
            kind: "external",
            name: p.name,
            email: p.email ?? null,
            specialty: null,
            external_role: p.external_role,
            client_id: p.client_id,
            contracted_weekly_hours: p.contracted_weekly_hours ?? null,
          })
          .select("id")
          .single();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Falha ao criar." };
  return { ok: true, data: { id: data.id } };
}

const meetingCreate = meetingSchema.and(z.object({ operation_id: z.string().uuid() }));

export async function mcpListMeetings(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ meetings: unknown[] }>> {
  const opId = typeof args.operation_id === "string" ? args.operation_id.trim() : "";
  if (!opId) return { ok: false, message: "operation_id obrigatório." };
  const { data, error } = await ctx.supabase
    .from("meetings")
    .select("id, operation_id, title, scheduled_at, visibility, notes, created_at")
    .eq("operation_id", opId)
    .order("scheduled_at", { ascending: false })
    .limit(clampLimit(args.limit));
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { meetings: data ?? [] } };
}

export async function mcpCreateMeeting(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const parsed = meetingCreate.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { operation_id, attendee_ids, ...m } = parsed.data;
  const { data, error } = await ctx.supabase
    .from("meetings")
    .insert({
      operation_id,
      title: m.title,
      scheduled_at: m.scheduled_at,
      notes: m.notes ?? null,
      visibility: m.visibility,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Falha ao criar." };
  if (attendee_ids.length > 0) {
    await ctx.supabase.from("meeting_attendees").insert(
      attendee_ids.map((person_id) => ({
        meeting_id: data.id,
        person_id,
      })),
    );
  }
  return { ok: true, data: { id: data.id } };
}

const decisionCreate = decisionSchema.and(z.object({ operation_id: z.string().uuid() }));

export async function mcpListDecisions(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ decisions: unknown[] }>> {
  const opId = typeof args.operation_id === "string" ? args.operation_id.trim() : "";
  if (!opId) return { ok: false, message: "operation_id obrigatório." };
  const { data, error } = await ctx.supabase
    .from("decisions")
    .select(
      "id, operation_id, title, visibility, decided_at, meeting_id, agenda_item_id, created_at",
    )
    .eq("operation_id", opId)
    .order("decided_at", { ascending: false })
    .limit(clampLimit(args.limit));
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { decisions: data ?? [] } };
}

export async function mcpCreateDecision(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const parsed = decisionCreate.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { operation_id, ...d } = parsed.data;
  const { data, error } = await ctx.supabase
    .from("decisions")
    .insert({
      operation_id,
      title: d.title,
      context: d.context ?? null,
      decision: d.decision,
      visibility: d.visibility,
      decided_at: d.decided_at,
      meeting_id: d.meeting_id ?? null,
      agenda_item_id: d.agenda_item_id ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Falha ao criar." };
  return { ok: true, data: { id: data.id } };
}

export async function mcpGetOperationBriefing(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ briefing: unknown; version: unknown }>> {
  const opId = typeof args.operation_id === "string" ? args.operation_id.trim() : "";
  if (!opId) return { ok: false, message: "operation_id obrigatório." };
  const { data: briefing, error } = await ctx.supabase
    .from("briefings")
    .select("id, operation_id, current_version_id, created_at, updated_at")
    .eq("operation_id", opId)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!briefing?.current_version_id) {
    return { ok: true, data: { briefing: null, version: null } };
  }
  const { data: version, error: vErr } = await ctx.supabase
    .from("briefing_versions")
    .select("*")
    .eq("id", briefing.current_version_id)
    .maybeSingle();
  if (vErr) return { ok: false, message: vErr.message };
  return { ok: true, data: { briefing, version } };
}

export async function mcpUpsertOperationBriefing(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ operation_id: string; briefing_id: string; version_id: string }>> {
  const opId = typeof args.operation_id === "string" ? args.operation_id.trim() : "";
  if (!opId) return { ok: false, message: "operation_id obrigatório." };
  const { operation_id: _o, idempotency_key: _ik, ...rest } = args;
  const parsed = briefingSchema.safeParse(rest);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { data: existing } = await ctx.supabase
    .from("briefings")
    .select("id")
    .eq("operation_id", opId)
    .maybeSingle();

  let briefingId = existing?.id ?? null;
  if (!briefingId) {
    const { data: inserted, error: insErr } = await ctx.supabase
      .from("briefings")
      .insert({ operation_id: opId })
      .select("id")
      .single();
    if (insErr) return { ok: false, message: insErr.message };
    briefingId = inserted?.id ?? null;
  }
  if (!briefingId) return { ok: false, message: "Falha ao criar briefing." };

  const { data: version, error: verErr } = await ctx.supabase
    .from("briefing_versions")
    .insert({
      briefing_id: briefingId,
      author_id: ctx.callerUserId,
      contexto: parsed.data.contexto ?? null,
      objetivos: parsed.data.objetivos ?? null,
      escopo_incluido: parsed.data.escopo_incluido ?? null,
      escopo_excluido: parsed.data.escopo_excluido ?? null,
      premissas: parsed.data.premissas ?? null,
      riscos: parsed.data.riscos ?? null,
      stakeholders: parsed.data.stakeholders ?? null,
      observacoes: parsed.data.observacoes ?? null,
    })
    .select("id")
    .single();
  if (verErr) return { ok: false, message: verErr.message };
  if (!version) return { ok: false, message: "Falha ao salvar versão." };

  const { error: updErr } = await ctx.supabase
    .from("briefings")
    .update({ current_version_id: version.id })
    .eq("id", briefingId);
  if (updErr) return { ok: false, message: updErr.message };

  return { ok: true, data: { operation_id: opId, briefing_id: briefingId, version_id: version.id } };
}
