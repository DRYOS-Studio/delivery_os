import { describe, expect, it } from "vitest";
import {
  clientChargeNetDue,
  computeDiscountAmount,
} from "@/lib/utils/client-charge-amount";

describe("client charge discount", () => {
  it("10% sobre R$ 3000 = 300 de desconto", () => {
    expect(computeDiscountAmount(3000, "percent", 10)).toBe(300);
    expect(clientChargeNetDue(3000, 300)).toBe(2700);
  });

  it("desconto fixo R$ 250", () => {
    expect(computeDiscountAmount(1000, "fixed", 250)).toBe(250);
    expect(clientChargeNetDue(1000, 250)).toBe(750);
  });

  it("desconto não ultrapassa o bruto", () => {
    expect(computeDiscountAmount(100, "fixed", 500)).toBe(100);
    expect(computeDiscountAmount(100, "percent", 200)).toBe(100);
  });
});
