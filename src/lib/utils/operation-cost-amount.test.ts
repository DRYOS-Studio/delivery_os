import { describe, expect, it } from "vitest";
import {
  computeCommissionBaseRevenue,
  computeCommissionMonthlyAmount,
  resolveOperationCostMonthlyAmount,
} from "@/lib/utils/operation-cost-amount";

describe("operation cost commission", () => {
  it("base líquida: MRR 3000, imposto 6% → 2820", () => {
    expect(computeCommissionBaseRevenue(3000, 6)).toBe(2820);
  });

  it("comissão 10% sobre líquido: (3000 − 180) × 10% = 282", () => {
    expect(computeCommissionMonthlyAmount(3000, 10, 6)).toBe(282);
  });

  it("sem imposto cadastrado: base = MRR → 10% de 3000 = 300", () => {
    expect(computeCommissionMonthlyAmount(3000, 10, null)).toBe(300);
    expect(computeCommissionMonthlyAmount(3000, 10, 0)).toBe(300);
  });

  it("legado comissão em R$ ignora percent ausente", () => {
    expect(
      resolveOperationCostMonthlyAmount(
        {
          category: "comissoes",
          amount: 150,
          commissionPercent: null,
        },
        { chargedRevenue: 3000, taxRatePct: 6 },
      ),
    ).toBe(150);
  });

  it("comissão percentual usa MRR e alíquota", () => {
    expect(
      resolveOperationCostMonthlyAmount(
        {
          category: "comissoes",
          amount: null,
          commissionPercent: 10,
        },
        { chargedRevenue: 3000, taxRatePct: 6 },
      ),
    ).toBe(282);
  });
});
