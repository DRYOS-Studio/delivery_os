import { clientSoftwareItemSchema } from "@/lib/validators/client-software-item";
import { clientTechItemSchema } from "@/lib/validators/client-tech-item";
import {
  mcpRequireAdmin,
  type McpHandlerContext,
  type McpToolResult,
} from "@/lib/mcp/tools/shared";
import { z } from "zod";

const uuid = z.string().uuid();

export async function mcpListClientTechItems(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ items: unknown[] }>> {
  const clientId =
    typeof args.client_id === "string" ? args.client_id.trim() : "";
  if (!clientId) return { ok: false, message: "client_id obrigatório." };
  const { data, error } = await ctx.supabase
    .from("client_tech_items")
    .select("id, client_id, name, category, url, notes, sort_order")
    .eq("client_id", clientId)
    .order("sort_order", { ascending: true });
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { items: data ?? [] } };
}

export async function mcpCreateClientTechItem(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const parsed = clientTechItemSchema
    .and(z.object({ client_id: uuid }))
    .safeParse(args);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }
  const { client_id, ...row } = parsed.data;
  const { data, error } = await ctx.supabase
    .from("client_tech_items")
    .insert({
      client_id,
      name: row.name,
      category: row.category ?? null,
      url: row.url ?? null,
      notes: row.notes ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Falha ao criar." };
  return { ok: true, data: { id: data.id } };
}

export async function mcpDeleteClientTechItem(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const itemId = typeof args.item_id === "string" ? args.item_id.trim() : "";
  const clientId =
    typeof args.client_id === "string" ? args.client_id.trim() : "";
  if (!itemId || !clientId) {
    return { ok: false, message: "item_id e client_id obrigatórios." };
  }
  const { error } = await ctx.supabase
    .from("client_tech_items")
    .delete()
    .eq("id", itemId)
    .eq("client_id", clientId);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id: itemId } };
}

export async function mcpListClientSoftwareItems(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ items: unknown[] }>> {
  const clientId =
    typeof args.client_id === "string" ? args.client_id.trim() : "";
  if (!clientId) return { ok: false, message: "client_id obrigatório." };
  const { data, error } = await ctx.supabase
    .from("client_software_items")
    .select("id, client_id, name, purpose, url, notes, sort_order")
    .eq("client_id", clientId)
    .order("sort_order", { ascending: true });
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { items: data ?? [] } };
}

export async function mcpCreateClientSoftwareItem(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const parsed = clientSoftwareItemSchema
    .and(z.object({ client_id: uuid }))
    .safeParse(args);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }
  const { client_id, ...row } = parsed.data;
  const { data, error } = await ctx.supabase
    .from("client_software_items")
    .insert({
      client_id,
      name: row.name,
      purpose: row.purpose ?? null,
      url: row.url ?? null,
      notes: row.notes ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Falha ao criar." };
  return { ok: true, data: { id: data.id } };
}

export async function mcpDeleteClientSoftwareItem(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const itemId = typeof args.item_id === "string" ? args.item_id.trim() : "";
  const clientId =
    typeof args.client_id === "string" ? args.client_id.trim() : "";
  if (!itemId || !clientId) {
    return { ok: false, message: "item_id e client_id obrigatórios." };
  }
  const { error } = await ctx.supabase
    .from("client_software_items")
    .delete()
    .eq("id", itemId)
    .eq("client_id", clientId);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id: itemId } };
}
