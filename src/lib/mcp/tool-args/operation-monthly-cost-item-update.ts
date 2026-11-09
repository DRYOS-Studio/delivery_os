import { z } from "zod";
import { applyClearable, mcpClearableText } from "@/lib/mcp/tool-args/clearable";
import { OPERATION_MONTHLY_COST_CATEGORIES_UI } from "@/lib/utils/operation-monthly-cost-category";

export const mcpUpdateOperationMonthlyCostItemSchema = z.object({
  item_id: z.string().uuid(),
  category: z.enum(OPERATION_MONTHLY_COST_CATEGORIES_UI).optional(),
  amount: z.number().nonnegative().optional(),
  description: mcpClearableText(500),
});

export type McpUpdateOperationMonthlyCostItemInput = z.infer<
  typeof mcpUpdateOperationMonthlyCostItemSchema
>;

export function buildOperationMonthlyCostItemPatch(
  input: McpUpdateOperationMonthlyCostItemInput,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.category !== undefined) patch.category = input.category;
  if (input.amount !== undefined) patch.amount = input.amount;
  applyClearable(patch, "description", input.description);
  return patch;
}
