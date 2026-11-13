import { operationTaxRateSchema } from "@/lib/validators/operation-tax-rate";
import {
  mcpRequireAdmin,
  type McpHandlerContext,
  type McpToolResult,
} from "@/lib/mcp/tools/shared";
import { z } from "zod";

const argsSchema = operationTaxRateSchema.extend({
  operation_id: z.string().uuid(),
});

export async function mcpUpdateOperationTaxRate(
  ctx: McpHandlerContext,
  args: Record<string, unknown>,
): Promise<McpToolResult<{ operation_id: string; tax_rate_pct: number | null }>> {
  const denied = await mcpRequireAdmin(ctx);
  if (denied) return denied;
  const parsed = argsSchema.safeParse(args);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Parâmetros inválidos.",
    };
  }
  const { operation_id, tax_rate_pct } = parsed.data;
  const { error } = await ctx.supabase
    .from("operation_financials")
    .upsert({ operation_id, tax_rate_pct }, { onConflict: "operation_id" });
  if (error) return { ok: false, message: error.message };
  return {
    ok: true,
    data: { operation_id, tax_rate_pct: tax_rate_pct ?? null },
  };
}
