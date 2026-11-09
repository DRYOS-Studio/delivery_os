import { describe, expect, it } from "vitest";
import { buildOperationMonthlyCostItemPatch } from "@/lib/mcp/tool-args/operation-monthly-cost-item-update";
import { mcpUpdateOperationMonthlyCostItemSchema } from "@/lib/mcp/tool-args/operation-monthly-cost-item-update";

describe("mcpUpdateOperationMonthlyCostItem clearable", () => {
  it("description: null entra no patch", () => {
    const parsed = mcpUpdateOperationMonthlyCostItemSchema.parse({
      item_id: "00000000-0000-4000-8000-000000000001",
      description: null,
    });
    const patch = buildOperationMonthlyCostItemPatch(parsed);
    expect(patch.description).toBeNull();
  });

  it("omitir description não altera patch", () => {
    const parsed = mcpUpdateOperationMonthlyCostItemSchema.parse({
      item_id: "00000000-0000-4000-8000-000000000001",
      amount: 300,
    });
    const patch = buildOperationMonthlyCostItemPatch(parsed);
    expect("description" in patch).toBe(false);
    expect(patch.amount).toBe(300);
  });
});
