import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { clientSchema } from "@/lib/validators/client";
import {
  clampLimit,
  clampOffset,
  mcpRequireAdmin,
  type McpHandlerContext,
  type McpToolResult,
} from "@/lib/mcp/tools/shared";
import { z } from "zod";

const CLIENT_SELECT =
  "id, name, slug, notes, legal_name, cnpj, primary_contact_name, primary_contact_email, primary_contact_phone, address_city, address_state, created_at, updated_at, archived_at";

function clientPayload(data: z.infer<typeof clientSchema>) {
  return {
    name: data.name,
    slug: data.slug,
    notes: data.notes ?? null,
    legal_name: data.legal_name ?? null,
    cnpj: data.cnpj ?? null,
    inscricao_estadual: data.inscricao_estadual ?? null,
    primary_contact_name: data.primary_contact_name ?? null,
    primary_contact_email: data.primary_contact_email ?? null,
    primary_contact_phone: data.primary_contact_phone ?? null,
    address_street: data.address_street ?? null,
    address_number: data.address_number ?? null,
    address_complement: data.address_complement ?? null,
    address_district: data.address_district ?? null,
    address_city: data.address_city ?? null,
    address_state: data.address_state ?? null,
    address_zip: data.address_zip ?? null,
  };
}

export async function mcpListClients(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ clients: unknown[] }>> {
  const includeArchived = args.include_archived === true;
  const limit = clampLimit(args.limit);
  const offset = clampOffset(args.offset);
  let q = ctx.supabase
    .from("clients")
    .select(CLIENT_SELECT)
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);
  if (!includeArchived) q = q.is("archived_at", null);
  const { data, error } = await q;
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { clients: data ?? [] } };
}

export async function mcpGetClient(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ client: unknown }>> {
  const id = typeof args.client_id === "string" ? args.client_id.trim() : "";
  if (!id) return { ok: false, message: "client_id obrigatório." };
  const { data, error } = await ctx.supabase
    .from("clients")
    .select(CLIENT_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Cliente não encontrado.", notFound: true };
  return { ok: true, data: { client: data } };
}

const createClientArgs = clientSchema;

export async function mcpCreateClient(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string; slug: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const parsed = createClientArgs.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { data, error } = await ctx.supabase
    .from("clients")
    .insert(clientPayload(parsed.data))
    .select("id, slug")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, message: "Slug já em uso." };
    return { ok: false, message: error.message };
  }
  if (!data) return { ok: false, message: "Falha ao criar." };
  return { ok: true, data };
}

export async function mcpUpdateClient(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const id = typeof args.client_id === "string" ? args.client_id.trim() : "";
  if (!id) return { ok: false, message: "client_id obrigatório." };
  const { client_id: _cid, idempotency_key: _ik, ...rest } = args;
  const parsed = createClientArgs.safeParse(rest);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { error } = await ctx.supabase
    .from("clients")
    .update(clientPayload(parsed.data))
    .eq("id", id);
  if (error) {
    if (error.code === "23505") return { ok: false, message: "Slug já em uso." };
    return { ok: false, message: error.message };
  }
  return { ok: true, data: { id } };
}

export async function mcpArchiveClient(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const id = typeof args.client_id === "string" ? args.client_id.trim() : "";
  if (!id) return { ok: false, message: "client_id obrigatório." };
  if (args.confirm !== true) {
    return {
      ok: false,
      message: "Arquivar cliente exige confirm: true (cascata via archive_client_cascade).",
    };
  }
  const { error } = await ctx.supabase.rpc("archive_client_cascade", {
    p_client_id: id,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id } };
}

export async function mcpRestoreClient(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const id = typeof args.client_id === "string" ? args.client_id.trim() : "";
  if (!id) return { ok: false, message: "client_id obrigatório." };
  const { error } = await ctx.supabase
    .from("clients")
    .update({ archived_at: null })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id } };
}
