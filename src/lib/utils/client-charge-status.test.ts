import { describe, expect, it } from "vitest";
import {
  clientChargeHasPartialPayment,
  clientChargeOpenAmount,
  effectiveClientChargeStatus,
} from "@/lib/utils/client-charge-status";

describe("effectiveClientChargeStatus com líquido", () => {
  it("marca atrasada quando vencida e não quitada (líquido)", () => {
    expect(
      effectiveClientChargeStatus(
        {
          status: "prevista",
          dueDate: "2026-01-05",
          netDue: 2700,
          paidAmount: null,
        },
        "2026-01-10",
      ),
    ).toBe("atrasada");
  });

  it("paga quando paid >= líquido", () => {
    expect(
      effectiveClientChargeStatus(
        {
          status: "emitida",
          dueDate: "2026-01-05",
          netDue: 2700,
          paidAmount: 2700,
        },
        "2026-06-01",
      ),
    ).toBe("paga");
  });

  it("parcial: saldo em aberto e atrasada se vencida", () => {
    const input = {
      status: "emitida" as const,
      dueDate: "2026-06-01",
      netDue: 1000,
      paidAmount: 400,
    };
    expect(clientChargeHasPartialPayment(input)).toBe(true);
    expect(clientChargeOpenAmount(input, "2026-06-15")).toBe(600);
    expect(effectiveClientChargeStatus(input, "2026-06-15")).toBe("atrasada");
  });
});
