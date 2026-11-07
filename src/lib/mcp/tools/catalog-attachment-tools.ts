import { attachmentUploadSchema, MAX_ATTACHMENT_BYTES } from "@/lib/validators/attachment";
import { sanitizeFilename } from "@/lib/utils/file";
import {
  clampLimit,
  type McpHandlerContext,
  type McpToolResult,
} from "@/lib/mcp/tools/shared";
import { z } from "zod";

const BUCKET = "attachments";
export const MCP_ATTACHMENT_MAX_BYTES = Math.min(MAX_ATTACHMENT_BYTES, 5 * 1024 * 1024);

export async function mcpListServiceProducts(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ products: unknown[] }>> {
  void ctx;
  const includeArchived = args.include_archived === true;
  let q = ctx.supabase
    .from("service_products")
    .select(
      "id, name, slug, catalog_group, catalog_kind, default_cycle_type, archived_at, sort_order",
    )
    .order("sort_order", { ascending: true })
    .limit(clampLimit(args.limit, 50, 100));
  if (!includeArchived) q = q.is("archived_at", null);
  const { data, error } = await q;
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { products: data ?? [] } };
}

export async function mcpListAttachments(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ attachments: unknown[] }>> {
  const opId = typeof args.operation_id === "string" ? args.operation_id.trim() : "";
  if (!opId) return { ok: false, message: "operation_id obrigatório." };
  const { data, error } = await ctx.supabase
    .from("attachments")
    .select(
      "id, operation_id, filename, mime_type, size_bytes, visibility, description, meeting_id, created_at",
    )
    .eq("operation_id", opId)
    .order("created_at", { ascending: false })
    .limit(clampLimit(args.limit));
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { attachments: data ?? [] } };
}

const uploadAttachmentArgs = attachmentUploadSchema.and(
  z.object({
    operation_id: z.string().uuid(),
    content_base64: z.string().min(1),
  }),
);

export async function mcpUploadAttachment(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string; storage_path: string }>> {
  const parsed = uploadAttachmentArgs.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const buf = Buffer.from(parsed.data.content_base64, "base64");
  if (buf.length === 0) return { ok: false, message: "Arquivo vazio." };
  if (buf.length > MCP_ATTACHMENT_MAX_BYTES) {
    return { ok: false, message: `Anexo maior que ${MCP_ATTACHMENT_MAX_BYTES} bytes no MCP.` };
  }
  if (parsed.data.meeting_id) {
    const { data: m, error: mErr } = await ctx.supabase
      .from("meetings")
      .select("operation_id")
      .eq("id", parsed.data.meeting_id)
      .maybeSingle();
    if (mErr) return { ok: false, message: mErr.message };
    if (!m || m.operation_id !== parsed.data.operation_id) {
      return { ok: false, message: "Reunião inválida para a operação." };
    }
  }

  const sanitized = sanitizeFilename(parsed.data.filename);
  const storagePath = `${parsed.data.operation_id}/${crypto.randomUUID()}-${sanitized}`;
  const { error: upErr } = await ctx.supabase.storage
    .from(BUCKET)
    .upload(storagePath, buf, { contentType: parsed.data.mime_type, upsert: false });
  if (upErr) return { ok: false, message: upErr.message };

  const { data, error } = await ctx.supabase
    .from("attachments")
    .insert({
      operation_id: parsed.data.operation_id,
      storage_path: storagePath,
      filename: parsed.data.filename,
      mime_type: parsed.data.mime_type,
      size_bytes: buf.length,
      description: parsed.data.description ?? null,
      meeting_id: parsed.data.meeting_id ?? null,
      visibility: parsed.data.visibility,
      uploaded_by: ctx.callerUserId,
    })
    .select("id, storage_path")
    .single();
  if (error) {
    await ctx.supabase.storage.from(BUCKET).remove([storagePath]);
    return { ok: false, message: error.message };
  }
  if (!data) return { ok: false, message: "Falha ao registrar anexo." };
  return { ok: true, data };
}

export async function mcpGetAttachmentDownloadUrl(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ signed_url: string; expires_in: number }>> {
  const id = typeof args.attachment_id === "string" ? args.attachment_id.trim() : "";
  if (!id) return { ok: false, message: "attachment_id obrigatório." };
  const { data: row, error } = await ctx.supabase
    .from("attachments")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!row) return { ok: false, message: "Anexo não encontrado.", notFound: true };
  const expiresIn = 3600;
  const { data: signed, error: signErr } = await ctx.supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, expiresIn);
  if (signErr || !signed?.signedUrl) {
    return { ok: false, message: signErr?.message ?? "Falha ao assinar." };
  }
  return { ok: true, data: { signed_url: signed.signedUrl, expires_in: expiresIn } };
}

export async function mcpListCatalogVillains(
  ctx: McpHandlerContext,
): Promise<McpToolResult<{ villains: unknown[] }>> {
  const { data, error } = await ctx.supabase
    .from("villains")
    .select("id, name, slug, archived_at")
    .is("archived_at", null)
    .order("name");
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { villains: data ?? [] } };
}

export async function mcpListQuickWinCatalog(
  ctx: McpHandlerContext,
): Promise<McpToolResult<{ items: unknown[] }>> {
  const { data, error } = await ctx.supabase
    .from("quick_win_catalog")
    .select("id, title, default_impact_pct, archived_at")
    .is("archived_at", null)
    .order("title")
    .limit(100);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { items: data ?? [] } };
}
