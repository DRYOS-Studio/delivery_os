import { clientContractFormSchema } from "@/lib/validators/client-contract";
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

const feeSchema = z
  .union([z.number(), z.string()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  })
  .refine((n) => n === null || n >= 0, "Taxa não pode ser negativa.");

const contractMetaArgs = clientContractFormSchema.and(
  z.object({
    client_id: z.string().uuid(),
    implementation_fee: feeSchema.optional(),
  }),
);

function metaToRow(
  clientId: string,
  d: z.infer<typeof contractMetaArgs>,
  file: { storage_path: string; filename: string; mime_type: string; size_bytes: number },
  uploadedBy: string,
) {
  return {
    client_id: clientId,
    label: d.label,
    monthly_value: d.monthly_value,
    implementation_fee: d.implementation_fee ?? null,
    currency: d.currency ?? "BRL",
    reajuste_notes: d.reajuste_notes ?? null,
    start_date: d.start_date ?? null,
    first_billing_date: d.first_billing_date ?? null,
    implementation_fee_paid: d.implementation_fee_paid ?? false,
    end_date: d.end_date ?? null,
    payment_day_of_month: d.payment_day_of_month,
    status: d.status,
    notes: d.notes ?? null,
    storage_path: file.storage_path,
    filename: file.filename,
    mime_type: file.mime_type,
    size_bytes: file.size_bytes,
    uploaded_by: uploadedBy,
  };
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
  const id = typeof args.contract_id === "string" ? args.contract_id.trim() : "";
  if (!id) return { ok: false, message: "contract_id obrigatório." };
  const { contract_id: _c, idempotency_key: _ik, client_id: _cl, ...rest } = args;
  const parsed = clientContractFormSchema.and(z.object({ implementation_fee: feeSchema.optional() })).safeParse(rest);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const d = parsed.data;
  const { error } = await ctx.supabase
    .from("client_contracts")
    .update({
      label: d.label,
      monthly_value: d.monthly_value,
      implementation_fee: d.implementation_fee ?? null,
      currency: d.currency ?? "BRL",
      reajuste_notes: d.reajuste_notes ?? null,
      start_date: d.start_date ?? null,
      first_billing_date: d.first_billing_date ?? null,
      implementation_fee_paid: d.implementation_fee_paid ?? false,
      end_date: d.end_date ?? null,
      payment_day_of_month: d.payment_day_of_month,
      status: d.status,
      notes: d.notes ?? null,
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id } };
}

const uploadArgs = contractMetaArgs.and(
  z.object({
    filename: z.string().trim().min(1).max(255),
    mime_type: z.string().trim().min(1).max(120),
    content_base64: z.string().min(1),
  }),
);

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

  const row = metaToRow(
    clientId,
    parsed.data,
    {
      storage_path: storagePath,
      filename: parsed.data.filename,
      mime_type: parsed.data.mime_type,
      size_bytes: buf.length,
    },
    ctx.callerUserId,
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

const finalizeArgs = contractMetaArgs.and(
  z.object({
    storage_path: z.string().min(3),
    filename: z.string().trim().min(1),
    mime_type: z.string().trim().min(1),
    size_bytes: z.number().int().positive().max(52_428_800),
  }),
);

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
  const row = metaToRow(
    p.client_id,
    p,
    {
      storage_path: p.storage_path,
      filename: p.filename,
      mime_type: p.mime_type,
      size_bytes: p.size_bytes,
    },
    ctx.callerUserId,
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
  const parsed = contractMetaArgs.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const d = parsed.data;
  const { data, error } = await ctx.supabase
    .from("client_contracts")
    .insert({
      client_id: d.client_id,
      label: d.label,
      monthly_value: d.monthly_value,
      implementation_fee: d.implementation_fee ?? null,
      implementation_fee_paid: d.implementation_fee_paid ?? false,
      currency: d.currency ?? "BRL",
      reajuste_notes: d.reajuste_notes ?? null,
      start_date: d.start_date ?? null,
      first_billing_date: d.first_billing_date ?? null,
      end_date: d.end_date ?? null,
      payment_day_of_month: d.payment_day_of_month,
      status: d.status,
      notes: d.notes ?? null,
      storage_path: null,
      filename: null,
      mime_type: null,
      size_bytes: 0,
      uploaded_by: ctx.callerUserId,
    })
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
