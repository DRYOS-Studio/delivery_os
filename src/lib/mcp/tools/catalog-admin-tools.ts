import { serviceProductSchema } from "@/lib/validators/service-product";
import { quickWinCatalogSchema } from "@/lib/validators/quick-win-catalog";
import {
  mcpRequireAdmin,
  type McpHandlerContext,
  type McpToolResult,
} from "@/lib/mcp/tools/shared";
import { z } from "zod";

export async function mcpCreateServiceProduct(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const parsed = serviceProductSchema.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const d = parsed.data;
  const { data, error } = await ctx.supabase
    .from("service_products")
    .insert({
      name: d.name,
      slug: d.slug,
      description: d.description ?? null,
      default_cycle_type: d.default_cycle_type ?? null,
      catalog_group: d.catalog_group ?? null,
      catalog_kind: d.catalog_kind ?? "product",
      content_ref: d.content_ref ?? null,
      sort_order: d.sort_order ?? 0,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, message: "Slug já em uso." };
    return { ok: false, message: error.message };
  }
  if (!data) return { ok: false, message: "Falha ao criar." };
  return { ok: true, data: { id: data.id } };
}

export async function mcpUpdateServiceProduct(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const id = typeof args.product_id === "string" ? args.product_id.trim() : "";
  if (!id) return { ok: false, message: "product_id obrigatório." };
  const { product_id: _p, idempotency_key: _ik, ...rest } = args;
  const parsed = serviceProductSchema.safeParse(rest);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const d = parsed.data;
  const { error } = await ctx.supabase
    .from("service_products")
    .update({
      name: d.name,
      slug: d.slug,
      description: d.description ?? null,
      default_cycle_type: d.default_cycle_type ?? null,
      catalog_group: d.catalog_group ?? null,
      catalog_kind: d.catalog_kind ?? "product",
      content_ref: d.content_ref ?? null,
      sort_order: d.sort_order ?? 0,
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id } };
}

export async function mcpArchiveServiceProduct(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const id = typeof args.product_id === "string" ? args.product_id.trim() : "";
  if (!id) return { ok: false, message: "product_id obrigatório." };
  const { error } = await ctx.supabase
    .from("service_products")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id } };
}

export async function mcpRestoreServiceProduct(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const id = typeof args.product_id === "string" ? args.product_id.trim() : "";
  if (!id) return { ok: false, message: "product_id obrigatório." };
  const { error } = await ctx.supabase
    .from("service_products")
    .update({ archived_at: null })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id } };
}

const qwcCreate = quickWinCatalogSchema;

export async function mcpCreateQuickWinCatalogItem(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const parsed = qwcCreate.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const d = parsed.data;
  const { data, error } = await ctx.supabase
    .from("quick_win_catalog")
    .insert({
      title: d.title,
      description: d.description ?? null,
      suggested_villain_id: d.suggested_villain_id ?? null,
      default_impact_pct: d.default_impact_pct ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Falha ao criar." };
  return { ok: true, data: { id: data.id } };
}

export async function mcpArchiveQuickWinCatalogItem(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ id: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const id = typeof args.catalog_item_id === "string" ? args.catalog_item_id.trim() : "";
  if (!id) return { ok: false, message: "catalog_item_id obrigatório." };
  const { error } = await ctx.supabase
    .from("quick_win_catalog")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { id } };
}
