import { describe, expect, it } from "vitest";
import {
  computeCommissionMonthlyAmount,
  resolveOperationCostMonthlyAmount,
} from "@/lib/utils/operation-cost-amount";

describe("operation cost commission", () => {
  it("10% sobre R$ 3.000 = R$ 300", () => {
    expect(computeCommissionMonthlyAmount(3000, 10)).toBe(300);
  });

  it("legado comissão em R$ ignora percent ausente", () => {
    expect(
      resolveOperationCostMonthlyAmount(
        {
          category: "comissoes",
          amount: 150,
          commissionPercent: null,
        },
        3000,
      ),
    ).toBe(150);
  });

  it("comissão percentual recalcula com MRR", () => {
    expect(
      resolveOperationCostMonthlyAmount(
        {
          category: "comissoes",
          amount: null,
          commissionPercent: 10,
        },
        5000,
      ),
    ).toBe(500);
  });
});
