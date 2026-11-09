import { describe, expect, it } from "vitest";
import { computeBreakdown } from "@/lib/db/queries/operation-costs";
import { computeMargin } from "@/lib/utils/margin";

describe("computeBreakdown com imposto", () => {
  it("inclui imposto no total mensal e na margem (3000 × 6% = 180)", () => {
    const breakdown = computeBreakdown(
      "00000000-0000-4000-8000-000000000001",
      [],
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
      [
        {
          id: "00000000-0000-4000-8000-000000000002",
          operationId: "00000000-0000-4000-8000-000000000001",
          category: "time",
          amount: 500,
          description: null,
          createdAt: "",
          updatedAt: "",
        },
      ],
      [],
      [],
      { chargedRevenue: 3000, taxRatePct: null },
    );
    expect(breakdown.taxMonthlyAmount).toBe(0);
    expect(breakdown.totalMonthly).toBe(500);
    expect(breakdown.fixedCost).toBe(500);
  });

  it("margem com itens categorizados + imposto (MRR 3000, 6%, custos 500+300)", () => {
    const opId = "00000000-0000-4000-8000-000000000001";
    const lineItems = [
      {
        id: "00000000-0000-4000-8000-000000000010",
        operationId: opId,
        category: "time" as const,
        amount: 500,
        description: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "00000000-0000-4000-8000-000000000011",
        operationId: opId,
        category: "infra" as const,
        amount: 300,
        description: null,
        createdAt: "",
        updatedAt: "",
      },
    ];
    const breakdown = computeBreakdown(opId, lineItems, [], [], {
      chargedRevenue: 3000,
      taxRatePct: 6,
    });
    expect(breakdown.fixedCost).toBe(800);
    expect(breakdown.taxMonthlyAmount).toBe(180);
    expect(breakdown.totalMonthly).toBe(980);
    const margin = computeMargin(3000, breakdown.totalMonthly);
    expect(margin.value).toBe(2020);
  });
});
