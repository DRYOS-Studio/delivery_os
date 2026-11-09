import {
  repositoryLinkBodySchema,
  repositoryLinkCreateSchema,
  repositoryLinkUpdateSchema,
} from "@/lib/validators/repository-link";
import {
  clampLimit,
  mcpRequireAdmin,
  type McpHandlerContext,
  type McpToolResult,
} from "@/lib/mcp/tools/shared";

const SELECT =
  "id, client_id, operation_id, frente_id, label, url, notes, sort_order, created_at";

export async function mcpListRepositoryLinks(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ links: unknown[] }>> {
  const clientId =
    typeof args.client_id === "string" ? args.client_id.trim() : "";
  if (!clientId) return { ok: false, message: "client_id obrigatório." };
  const operationId =
    typeof args.operation_id === "string" ? args.operation_id.trim() : "";
  const frenteId =
    typeof args.frente_id === "string" ? args.frente_id.trim() : "";
  const limit = clampLimit(args.limit);

  let q = ctx.supabase
    .from("repository_links")
    .select(SELECT)
    .eq("client_id", clientId)
    .order("sort_order", { ascending: true })
    .limit(limit);

  if (frenteId) {
    q = q.or(
      `frente_id.eq.${frenteId},and(operation_id.eq.${operationId},frente_id.is.null),and(operation_id.is.null,frente_id.is.null)`,
    );
  } else if (operationId) {
    q = q.or(
      `and(operation_id.eq.${operationId},frente_id.is.null),and(operation_id.is.null,frente_id.is.null)`,
    );
  } else {
    q = q.is("operation_id", null).is("frente_id", null);
  }

  const { data, error } = await q;
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { links: data ?? [] } };
}

export async function mcpCreateRepositoryLink(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const parsed = repositoryLinkCreateSchema.safeParse(args);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }
  const { client_id, operation_id, frente_id, ...body } = parsed.data;
  const clientScope =
    !operation_id && !frente_id;
  if (clientScope) {
    const denied = await mcpRequireAdmin(ctx);
    if (denied) return denied;
  }
  const { data, error } = await ctx.supabase
    .from("repository_links")
    .insert({
      client_id,
      operation_id: operation_id ?? null,
      frente_id: frente_id ?? null,
      label: body.label,
      url: body.url,
      notes: body.notes ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Falha ao criar." };
  return { ok: true, data: { id: data.id } };
}

export async function mcpUpdateRepositoryLink(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const parsed = repositoryLinkUpdateSchema.safeParse(args);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }
  const { link_id, ...body } = parsed.data;
  const { error } = await ctx.supabase
    .from("repository_links")
    .update({
      label: body.label,
      url: body.url,
      notes: body.notes ?? null,
    })
    .eq("id", link_id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id: link_id } };
}

export async function mcpDeleteRepositoryLink(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const id = typeof args.link_id === "string" ? args.link_id.trim() : "";
  if (!id) return { ok: false, message: "link_id obrigatório." };
  const { error } = await ctx.supabase
    .from("repository_links")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id } };
}
