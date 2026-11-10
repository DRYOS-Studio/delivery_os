import { describe, expect, it } from "vitest";
import {
  clientChargeOpenAmount,
  effectiveClientChargeStatus,
} from "@/lib/utils/client-charge-status";

describe("effectiveClientChargeStatus", () => {
  it("marca atrasada quando vencida e não quitada", () => {
    expect(
      effectiveClientChargeStatus(
        {
          status: "prevista",
          dueDate: "2026-01-05",
          amount: 3000,
          paidAmount: null,
        },
        "2026-01-10",
      ),
    ).toBe("atrasada");
  });

  it("permanece paga quando paid_amount >= amount", () => {
    expect(
      effectiveClientChargeStatus(
        {
          status: "emitida",
          dueDate: "2026-01-05",
          amount: 3000,
          paidAmount: 3000,
        },
        "2026-06-01",
      ),
    ).toBe("paga");
  });

  it("pagamento parcial mantém em aberto", () => {
    expect(
      effectiveClientChargeStatus(
        {
          status: "emitida",
          dueDate: "2026-06-01",
          amount: 1000,
          paidAmount: 400,
        },
        "2026-06-15",
      ),
    ).toBe("atrasada");
    expect(
      clientChargeOpenAmount(
        {
          status: "emitida",
          dueDate: "2026-06-01",
          amount: 1000,
          paidAmount: 400,
        },
        "2026-06-15",
      ),
    ).toBe(600);
  });
});
