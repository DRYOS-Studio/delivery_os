import { describe, expect, it } from "vitest";
import { mcpUpdateOperationCostSchema } from "@/lib/validators/operationCost";

describe("mcpUpdateOperationCost clearable", () => {
  it("notes: null é aceito", () => {
    const parsed = mcpUpdateOperationCostSchema.parse({
      cost_id: "00000000-0000-4000-8000-000000000001",
      notes: null,
    });
    expect(parsed.notes).toBeNull();
  });

  it("omitir notes", () => {
    const parsed = mcpUpdateOperationCostSchema.parse({
      cost_id: "00000000-0000-4000-8000-000000000001",
      amount: 300,
    });
    expect(parsed.notes).toBeUndefined();
    expect(parsed.amount).toBe(300);
  });
});
