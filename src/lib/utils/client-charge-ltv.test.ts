import { describe, expect, it } from "vitest";
import type { ClientChargeRow } from "@/lib/db/queries/client-charges";
import {
  computeClientLtvFromCharges,
  computeLtvCacRatio,
} from "@/lib/utils/client-charge-ltv";

function charge(
  partial: Partial<ClientChargeRow> & Pick<ClientChargeRow, "status">,
): ClientChargeRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    clientId: "00000000-0000-4000-8000-000000000099",
    clientContractId: null,
    operationId: null,
    chargeType: "mensalidade",
    competence: "2026-11",
    dueDate: "2026-11-10",
    amount: 1000,
    discountKind: "none",
    discountInput: null,
    discountAmount: 0,
    netDue: 1000,
    status: partial.status,
    effectiveStatus: partial.effectiveStatus ?? partial.status,
    openAmount: partial.openAmount ?? 0,
    paidAt: partial.paidAt ?? null,
    paidAmount: partial.paidAmount ?? null,
    paymentMethod: null,
    notes: null,
    externalProvider: null,
    externalId: null,
    createdAt: "",
    updatedAt: "",
  };
}

describe("computeClientLtvFromCharges", () => {
  it("soma paid_amount com paid_at e ignora cancelada", () => {
    const totals = computeClientLtvFromCharges([
      charge({
        status: "paga",
        paidAt: "2026-10-05",
        paidAmount: 1500,
        openAmount: 0,
      }),
      charge({
        status: "paga",
        chargeType: "implantacao",
        paidAt: "2026-09-01",
        paidAmount: 800,
        openAmount: 0,
      } as Partial<ClientChargeRow> & { status: "paga" }),
      charge({ status: "cancelada", paidAt: "2026-08-01", paidAmount: 999 }),
      charge({
        status: "prevista",
        paidAmount: null,
        openAmount: 1200,
      }),
    ]);
    expect(totals.ltvReceived).toBe(2300);
    expect(totals.receivablePending).toBe(1200);
  });

  it("não conta pagamento sem paid_at", () => {
    const totals = computeClientLtvFromCharges([
      charge({ status: "paga", paidAmount: 500, paidAt: null }),
    ]);
    expect(totals.ltvReceived).toBe(0);
  });
});

describe("computeLtvCacRatio", () => {
  it("retorna null sem CAC", () => {
    expect(computeLtvCacRatio(1000, 0)).toBeNull();
  });

  it("divide LTV por CAC", () => {
    expect(computeLtvCacRatio(3000, 1000)).toBe(3);
  });
});
