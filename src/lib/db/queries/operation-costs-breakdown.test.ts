import { describe, expect, it } from "vitest";
import { computeBreakdown } from "@/lib/db/queries/operation-costs";
import { computeMargin } from "@/lib/utils/margin";

describe("computeBreakdown com imposto", () => {
  it("inclui imposto no total mensal e na margem (3000 × 6% = 180)", () => {
    const breakdown = computeBreakdown(
      "00000000-0000-4000-8000-000000000001",
      0,
      [],
      [],
      { chargedRevenue: 3000, taxRatePct: 6 },
    );
    expect(breakdown.taxMonthlyAmount).toBe(180);
    expect(breakdown.totalMonthly).toBe(180);
    const margin = computeMargin(3000, breakdown.totalMonthly);
    expect(margin.value).toBe(2820);
  });

  it("sem alíquota não altera o total", () => {
    const breakdown = computeBreakdown(
      "00000000-0000-4000-8000-000000000001",
      500,
      [],
      [],
      { chargedRevenue: 3000, taxRatePct: null },
    );
    expect(breakdown.taxMonthlyAmount).toBe(0);
    expect(breakdown.totalMonthly).toBe(500);
  });
});
