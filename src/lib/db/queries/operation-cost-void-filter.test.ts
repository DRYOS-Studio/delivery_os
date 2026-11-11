import { describe, expect, it } from "vitest";
import { isOperationCostInMonthlyBreakdown } from "@/lib/db/queries/operation-costs";

describe("isOperationCostInMonthlyBreakdown", () => {
  const today = "2026-11-11";

  it("rejeita anulado mesmo vigente nas datas", () => {
    expect(
      isOperationCostInMonthlyBreakdown(
        {
          voided_at: "2026-11-01T00:00:00Z",
          started_at: "2026-01-01",
          ended_at: null,
        },
        today,
      ),
    ).toBe(false);
  });

  it("aceita vigente não anulado", () => {
    expect(
      isOperationCostInMonthlyBreakdown(
        {
          voided_at: null,
          started_at: "2026-01-01",
          ended_at: null,
        },
        today,
      ),
    ).toBe(true);
  });
});
