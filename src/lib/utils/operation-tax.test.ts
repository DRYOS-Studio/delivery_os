import { describe, expect, it } from "vitest";
import { computeTaxMonthlyAmount } from "@/lib/utils/operation-tax";

describe("computeTaxMonthlyAmount", () => {
  it("calcula 6% sobre R$ 3.000 = R$ 180", () => {
    expect(computeTaxMonthlyAmount(3000, 6)).toBe(180);
  });

  it("retorna 0 quando alíquota é null, undefined ou 0", () => {
    expect(computeTaxMonthlyAmount(3000, null)).toBe(0);
    expect(computeTaxMonthlyAmount(3000, undefined)).toBe(0);
    expect(computeTaxMonthlyAmount(3000, 0)).toBe(0);
  });

  it("retorna 0 quando receita cobrada é null, undefined ou 0", () => {
    expect(computeTaxMonthlyAmount(null, 6)).toBe(0);
    expect(computeTaxMonthlyAmount(undefined, 6)).toBe(0);
    expect(computeTaxMonthlyAmount(0, 6)).toBe(0);
  });
});
