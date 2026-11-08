import { frenteSchema } from "@/lib/validators/frente";
import {
  clampLimit,
  type McpHandlerContext,
  type McpToolResult,
} from "@/lib/mcp/tools/shared";
import { z } from "zod";

const FRENTE_SELECT =
  "id, operation_id, name, cycle_type, domain, phase, actionable_status, actionable_status_since, responsible_person_id, product_id, start_date, end_date, git_repository_url, archived_at, product:service_products ( id, name, slug, archived_at )";

function frentePayload(data: z.infer<typeof frenteSchema>) {
  const statusChanged = false;
  return {
    name: data.name,
    cycle_type: data.cycle_type,
    domain: data.domain,
    phase: data.phase,
    actionable_status: data.actionable_status,
    responsible_person_id: data.responsible_person_id ?? null,
    product_id: data.product_id ?? null,
    start_date: data.start_date ?? null,
    end_date: data.end_date ?? null,
    git_repository_url: data.git_repository_url ?? null,
    ...(statusChanged ? {} : {}),
  };
}

export async function mcpListFrentes(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ frentes: unknown[] }>> {
  const opId = typeof args.operation_id === "string" ? args.operation_id.trim() : "";
  if (!opId) return { ok: false, message: "operation_id obrigatório." };
  const includeArchived = args.include_archived === true;
  const limit = clampLimit(args.limit, 50, 100);
  let q = ctx.supabase
    .from("frentes")
    .select(FRENTE_SELECT)
    .eq("operation_id", opId)
    .order("name", { ascending: true })
    .limit(limit);
  if (!includeArchived) q = q.is("archived_at", null);
  const { data, error } = await q;
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { frentes: data ?? [] } };
}

export async function mcpGetFrente(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ frente: unknown }>> {
  const id = typeof args.frente_id === "string" ? args.frente_id.trim() : "";
  if (!id) return { ok: false, message: "frente_id obrigatório." };
  const { data, error } = await ctx.supabase
    .from("frentes")
    .select(FRENTE_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Frente não encontrada.", notFound: true };
  return { ok: true, data: { frente: data } };
}

const createFrenteArgs = frenteSchema.and(
  z.object({ operation_id: z.string().uuid() }),
);

export async function mcpCreateFrente(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string; operation_id: string }>> {
  const parsed = createFrenteArgs.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { operation_id, ...body } = parsed.data;
  const { data, error } = await ctx.supabase
    .from("frentes")
    .insert({
      operation_id,
      ...frentePayload(body),
    })
    .select("id, operation_id")
    .single();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Falha ao criar." };
  return { ok: true, data };
}

export async function mcpUpdateFrente(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const frenteId = typeof args.frente_id === "string" ? args.frente_id.trim() : "";
  if (!frenteId) return { ok: false, message: "frente_id obrigatório." };
  const { frente_id: _f, operation_id: _o, idempotency_key: _ik, ...rest } = args;

  const { data: current, error: curErr } = await ctx.supabase
    .from("frentes")
    .select("actionable_status")
    .eq("id", frenteId)
    .maybeSingle();
  if (curErr) return { ok: false, message: curErr.message };
  if (!current) return { ok: false, message: "Frente não encontrada.", notFound: true };

  const parsed = frenteSchema.safeParse(rest);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const statusChanged =
    current.actionable_status.trim().toLowerCase() !==
    parsed.data.actionable_status.trim().toLowerCase();

  const patch = {
    ...frentePayload(parsed.data),
    ...(statusChanged ? { actionable_status_since: new Date().toISOString() } : {}),
  };

  const { error } = await ctx.supabase.from("frentes").update(patch).eq("id", frenteId);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id: frenteId } };
}

export async function mcpArchiveFrente(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const id = typeof args.frente_id === "string" ? args.frente_id.trim() : "";
  if (!id) return { ok: false, message: "frente_id obrigatório." };
  if (args.confirm !== true) {
    return { ok: false, message: "Arquivar frente exige confirm: true." };
  }
  const { error } = await ctx.supabase.rpc("archive_frente_cascade", {
    p_frente_id: id,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id } };
}
