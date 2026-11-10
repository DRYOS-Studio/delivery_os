import {
  clientContractFieldsToDbPatch,
  clientContractMcpToRow,
  createClientContractMcpSchema,
  updateClientContractMcpSchema,
  type ClientContractMcpBody,
} from "@/lib/mcp/tool-args/contracts";
import { sanitizeFilename } from "@/lib/utils/file";
import {
  mcpRequireAdmin,
  type McpHandlerContext,
  type McpToolResult,
} from "@/lib/mcp/tools/shared";
import { z } from "zod";

const BUCKET = "contracts";
/** Limite conservador no MCP; arquivos maiores usam signed upload URL. */
export const MCP_CONTRACT_MAX_BYTES = 5 * 1024 * 1024;

const CONTRACT_SELECT =
  "id, client_id, label, monthly_value, implementation_fee, implementation_fee_paid, first_billing_date, currency, reajuste_notes, start_date, end_date, payment_day_of_month, status, notes, filename, mime_type, size_bytes, storage_path, created_at, updated_at";

const uploadArgs = createClientContractMcpSchema.extend({
  filename: z.string().trim().min(1).max(255),
  mime_type: z.string().trim().min(1).max(120),
  content_base64: z.string().min(1),
});

const finalizeArgs = createClientContractMcpSchema.extend({
  storage_path: z.string().min(3),
  filename: z.string().trim().min(1),
  mime_type: z.string().trim().min(1),
  size_bytes: z.number().int().positive().max(52_428_800),
});

function contractBodyFromCreateArgs(
  data: z.infer<typeof createClientContractMcpSchema>,
): ClientContractMcpBody {
  const {
    client_id: _clientId,
    idempotency_key: _ik,
    ...body
  } = data as z.infer<typeof createClientContractMcpSchema> & { idempotency_key?: string };
  return body;
}

export async function mcpListClientContracts(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ contracts: unknown[] }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const clientId = typeof args.client_id === "string" ? args.client_id.trim() : "";
  if (!clientId) return { ok: false, message: "client_id obrigatório." };
  const { data, error } = await ctx.supabase
    .from("client_contracts")
    .select(CONTRACT_SELECT)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { contracts: data ?? [] } };
}

export async function mcpGetClientContract(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ contract: unknown }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const id = typeof args.contract_id === "string" ? args.contract_id.trim() : "";
  if (!id) return { ok: false, message: "contract_id obrigatório." };
  const { data, error } = await ctx.supabase
    .from("client_contracts")
    .select(CONTRACT_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Contrato não encontrado.", notFound: true };
  return { ok: true, data: { contract: data } };
}

export async function mcpUpdateClientContract(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  try {
    const parsed = updateClientContractMcpSchema.safeParse(args);
    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Dados inválidos.",
      };
    }
    const id = parsed.data.contract_id;
    const { data: existing, error: fetchErr } = await ctx.supabase
      .from("client_contracts")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr) return { ok: false, message: fetchErr.message };
    if (!existing) {
      return { ok: false, message: "Contrato não encontrado.", notFound: true };
    }

    const patch = clientContractFieldsToDbPatch(parsed.data);
    const { error } = await ctx.supabase
      .from("client_contracts")
      .update(patch)
      .eq("id", id);
    if (error) return { ok: false, message: error.message };
    return { ok: true, data: { id } };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao atualizar contrato.";
    return { ok: false, message };
  }
}

export async function mcpUploadClientContract(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string; storage_path: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const parsed = uploadArgs.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const buf = Buffer.from(parsed.data.content_base64, "base64");
  if (buf.length === 0) return { ok: false, message: "Arquivo vazio." };
  if (buf.length > MCP_CONTRACT_MAX_BYTES) {
    return {
      ok: false,
      message: `Arquivo maior que ${MCP_CONTRACT_MAX_BYTES} bytes no MCP. Use begin_client_contract_upload.`,
    };
  }

  const clientId = parsed.data.client_id;
  const sanitized = sanitizeFilename(parsed.data.filename);
  const storagePath = `${clientId}/${crypto.randomUUID()}-${sanitized}`;

  const { error: upErr } = await ctx.supabase.storage
    .from(BUCKET)
    .upload(storagePath, buf, {
      contentType: parsed.data.mime_type,
      upsert: false,
    });
  if (upErr) return { ok: false, message: upErr.message };

  const row = clientContractMcpToRow(
    clientId,
    contractBodyFromCreateArgs(parsed.data),
    ctx.callerUserId,
    {
      storage_path: storagePath,
      filename: parsed.data.filename,
      mime_type: parsed.data.mime_type,
      size_bytes: buf.length,
    },
  );

  const { data, error } = await ctx.supabase
    .from("client_contracts")
    .insert(row)
    .select("id, storage_path")
    .single();
  if (error) {
    await ctx.supabase.storage.from(BUCKET).remove([storagePath]);
    return { ok: false, message: error.message };
  }
  if (!data?.storage_path) return { ok: false, message: "Falha ao registrar contrato." };
  return { ok: true, data: { id: data.id, storage_path: data.storage_path } };
}

export async function mcpBeginClientContractUpload(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ storage_path: string; signed_upload: unknown }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const clientId = typeof args.client_id === "string" ? args.client_id.trim() : "";
  const filename = typeof args.filename === "string" ? args.filename.trim() : "";
  if (!clientId || !filename) {
    return { ok: false, message: "client_id e filename obrigatórios." };
  }
  const sanitized = sanitizeFilename(filename);
  const storagePath = `${clientId}/${crypto.randomUUID()}-${sanitized}`;
  const { data, error } = await ctx.supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);
  if (error || !data) return { ok: false, message: error?.message ?? "Falha ao assinar upload." };
  return { ok: true, data: { storage_path: storagePath, signed_upload: data } };
}

export async function mcpFinalizeClientContractUpload(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const parsed = finalizeArgs.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const p = parsed.data;
  if (!p.storage_path.startsWith(`${p.client_id}/`)) {
    return { ok: false, message: "storage_path deve começar com client_id/." };
  }
  const row = clientContractMcpToRow(
    p.client_id,
    contractBodyFromCreateArgs(p),
    ctx.callerUserId,
    {
      storage_path: p.storage_path,
      filename: p.filename,
      mime_type: p.mime_type,
      size_bytes: p.size_bytes,
    },
  );
  const { data, error } = await ctx.supabase
    .from("client_contracts")
    .insert(row)
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Falha ao registrar." };
  return { ok: true, data: { id: data.id } };
}

/** Metadados sem arquivo (aceite WhatsApp, etc.). Campos = createClientContractAction sem file. */
export async function mcpCreateClientContract(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const parsed = createClientContractMcpSchema.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const d = parsed.data;
  const insertRow = clientContractMcpToRow(d.client_id, d, ctx.callerUserId);
  const { data, error } = await ctx.supabase
    .from("client_contracts")
    .insert(insertRow)
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Falha ao registrar contrato." };
  return { ok: true, data: { id: data.id } };
}

export async function mcpGetClientContractDownloadUrl(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ signed_url: string; expires_in: number }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const id = typeof args.contract_id === "string" ? args.contract_id.trim() : "";
  if (!id) return { ok: false, message: "contract_id obrigatório." };
  const { data: row, error } = await ctx.supabase
    .from("client_contracts")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!row) return { ok: false, message: "Contrato não encontrado.", notFound: true };
  if (!row.storage_path) {
    return { ok: false, message: "Contrato sem arquivo anexo.", notFound: true };
  }
  const expiresIn = 3600;
  const { data: signed, error: signErr } = await ctx.supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, expiresIn);
  if (signErr || !signed?.signedUrl) {
    return { ok: false, message: signErr?.message ?? "Falha ao assinar download." };
  }
  return { ok: true, data: { signed_url: signed.signedUrl, expires_in: expiresIn } };
}
