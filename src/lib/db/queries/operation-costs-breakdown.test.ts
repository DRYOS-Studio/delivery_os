import { describe, expect, it } from "vitest";
import { computeBreakdown } from "@/lib/db/queries/operation-costs";
import { computeMargin } from "@/lib/utils/margin";

describe("computeBreakdown com imposto", () => {
  it("inclui imposto no total mensal e na margem (3000 × 6% = 180)", () => {
    const breakdown = computeBreakdown(
      "00000000-0000-4000-8000-000000000001",
      [],
      [],
      { chargedRevenue: 3000, taxRatePct: 6 },
    );
    expect(breakdown.taxMonthlyAmount).toBe(180);
    expect(breakdown.totalMonthly).toBe(180);
    const margin = computeMargin(3000, breakdown.totalMonthly);
    expect(margin.value).toBe(2820);
  });

  it("soma custos mensais vigentes por categoria", () => {
    const opId = "00000000-0000-4000-8000-000000000001";
    const costs = [
      {
        id: "00000000-0000-4000-8000-000000000010",
        operationId: opId,
        label: "Time",
        category: "time" as const,
        amount: 500,
        commissionPercent: null,
        monthlyAmount: 500,
        recurrence: "mensal" as const,
        startedAt: "2026-01-01",
        endedAt: null,
        notes: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "00000000-0000-4000-8000-000000000011",
        operationId: opId,
        label: "Infra",
        category: "infra" as const,
        amount: 300,
        commissionPercent: null,
        monthlyAmount: 300,
        recurrence: "mensal" as const,
        startedAt: "2026-01-01",
        endedAt: null,
        notes: null,
        createdAt: "",
        updatedAt: "",
      },
    ];
    const breakdown = computeBreakdown(opId, costs, [], {
      chargedRevenue: 3000,
      taxRatePct: 6,
    });
    expect(breakdown.adHocMonthly).toBe(800);
    expect(breakdown.categorySubtotals.time).toBe(500);
    expect(breakdown.categorySubtotals.infra).toBe(300);
    expect(breakdown.taxMonthlyAmount).toBe(180);
    expect(breakdown.totalMonthly).toBe(980);
    const margin = computeMargin(3000, breakdown.totalMonthly);
    expect(margin.value).toBe(2020);
  });

  it("comissão % sobre MRR líquido de imposto (282 + imposto 180)", () => {
    const opId = "00000000-0000-4000-8000-000000000001";
    const costs = [
      {
        id: "00000000-0000-4000-8000-000000000020",
        operationId: opId,
        label: "Parceiro",
        category: "comissoes" as const,
        amount: null,
        commissionPercent: 10,
        monthlyAmount: 282,
        recurrence: "mensal" as const,
        startedAt: "2026-01-01",
        endedAt: null,
        notes: null,
        createdAt: "",
        updatedAt: "",
      },
    ];
    const breakdown = computeBreakdown(opId, costs, [], {
      chargedRevenue: 3000,
      taxRatePct: 6,
    });
    expect(breakdown.taxMonthlyAmount).toBe(180);
    expect(breakdown.categorySubtotals.comissoes).toBe(282);
    expect(breakdown.adHocMonthly).toBe(282);
    expect(breakdown.totalMonthly).toBe(462);
  });

  it("comissão % sem imposto: 10% de 3000 = 300", () => {
    const opId = "00000000-0000-4000-8000-000000000001";
    const costs = [
      {
        id: "00000000-0000-4000-8000-000000000021",
        operationId: opId,
        label: "Parceiro",
        category: "comissoes" as const,
        amount: null,
        commissionPercent: 10,
        monthlyAmount: 0,
        recurrence: "mensal" as const,
        startedAt: "2026-01-01",
        endedAt: null,
        notes: null,
        createdAt: "",
        updatedAt: "",
      },
    ];
    const breakdown = computeBreakdown(opId, costs, [], {
      chargedRevenue: 3000,
      taxRatePct: null,
    });
    expect(breakdown.categorySubtotals.comissoes).toBe(300);
  });
});
