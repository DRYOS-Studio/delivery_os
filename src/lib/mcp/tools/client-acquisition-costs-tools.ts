import {
  getClientAcquisitionCost,
  listClientAcquisitionCosts,
} from "@/lib/db/queries/client-acquisition-costs";
import { clientAcquisitionCostMcpSchema } from "@/lib/validators/client-acquisition-cost";
import {
  mcpRequireAdmin,
  type McpHandlerContext,
  type McpToolResult,
} from "@/lib/mcp/tools/shared";
import { z } from "zod";

function serialize(item: Awaited<ReturnType<typeof listClientAcquisitionCosts>>[number]) {
  return {
    id: item.id,
    client_id: item.clientId,
    spent_on: item.spentOn,
    description: item.description,
    category: item.category,
    amount: item.amount,
  };
}

const listArgs = z.object({
  client_id: z.string().uuid(),
});

export async function mcpListClientAcquisitionCosts(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ items: unknown[]; total_cac: number }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const parsed = listArgs.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: "client_id inválido." };
  }
  try {
    const items = await listClientAcquisitionCosts(parsed.data.client_id);
    const total_cac = items.reduce((s, i) => s + i.amount, 0);
    return {
      ok: true,
      data: {
        items: items.map(serialize),
        total_cac,
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao listar CAC.";
    return { ok: false, message };
  }
}

const createArgs = clientAcquisitionCostMcpSchema.extend({
  client_id: z.string().uuid(),
});

export async function mcpCreateClientAcquisitionCost(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ item: unknown }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const parsed = createArgs.safeParse(args);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Parâmetros inválidos.",
    };
  }
  const { client_id, ...body } = parsed.data;
  const { data, error } = await ctx.supabase
    .from("client_acquisition_costs")
    .insert({
      client_id,
      spent_on: body.spent_on,
      description: body.description,
      category: body.category,
      amount: body.amount,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Falha ao criar." };
  const row = await getClientAcquisitionCost(data.id);
  if (!row) return { ok: false, message: "Falha ao ler item criado." };
  return { ok: true, data: { item: serialize(row) } };
}

const updateArgs = clientAcquisitionCostMcpSchema.extend({
  acquisition_cost_id: z.string().uuid(),
});

export async function mcpUpdateClientAcquisitionCost(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ item: unknown }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const parsed = updateArgs.safeParse(args);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Parâmetros inválidos.",
    };
  }
  const { acquisition_cost_id, ...body } = parsed.data;
  const { error } = await ctx.supabase
    .from("client_acquisition_costs")
    .update({
      spent_on: body.spent_on,
      description: body.description,
      category: body.category,
      amount: body.amount,
    })
    .eq("id", acquisition_cost_id);
  if (error) return { ok: false, message: error.message };
  const row = await getClientAcquisitionCost(acquisition_cost_id);
  if (!row) return { ok: false, message: "Item não encontrado." };
  return { ok: true, data: { item: serialize(row) } };
}

const deleteArgs = z.object({ acquisition_cost_id: z.string().uuid() });

export async function mcpDeleteClientAcquisitionCost(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ acquisition_cost_id: string }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const parsed = deleteArgs.safeParse(args);
  if (!parsed.success) {
    return { ok: false, message: "acquisition_cost_id inválido." };
  }
  const { error } = await ctx.supabase
    .from("client_acquisition_costs")
    .delete()
    .eq("id", parsed.data.acquisition_cost_id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: { acquisition_cost_id: parsed.data.acquisition_cost_id } };
}
