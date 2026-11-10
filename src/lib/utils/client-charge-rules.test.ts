import { describe, expect, it } from "vitest";
import {
  canHardDeleteClientCharge,
  canUndoClientChargePayment,
  chargeHasPaymentRecorded,
  statusAfterUndoFullPayment,
  statusAfterPartialPayment,
  storedStatusAfterChargeEdit,
} from "@/lib/utils/client-charge-rules";

describe("client charge delete/cancel rules", () => {
  it("sem pagamento pode apagar", () => {
    expect(
      canHardDeleteClientCharge({
        status: "prevista",
        paidAmount: null,
        externalProvider: null,
      }),
    ).toBe(true);
  });

  it("com pagamento parcial não apaga — cancelar", () => {
    expect(
      canHardDeleteClientCharge({
        status: "emitida",
        paidAmount: 100,
        externalProvider: null,
      }),
    ).toBe(false);
    expect(
      chargeHasPaymentRecorded({
        status: "emitida",
        paidAmount: 100,
        externalProvider: null,
      }),
    ).toBe(true);
  });

  it("desfazer bloqueado com gateway", () => {
    expect(
      canUndoClientChargePayment({
        status: "paga",
        paidAmount: 3000,
        externalProvider: "stripe",
      }),
    ).toBe(false);
  });

  it("desfazer permitido sem gateway", () => {
    expect(
      canUndoClientChargePayment({
        status: "paga",
        paidAmount: 3000,
        externalProvider: null,
      }),
    ).toBe(true);
  });
});

describe("status após desfazer recebimento", () => {
  it("volta para prevista ou emitida", () => {
    expect(statusAfterUndoFullPayment("paga")).toBe("prevista");
    expect(statusAfterUndoFullPayment("emitida")).toBe("emitida");
  });

  it("parcial mantém emitida", () => {
    expect(statusAfterPartialPayment(500, 2000)).toBe("emitida");
    expect(statusAfterPartialPayment(2000, 2000)).toBe("paga");
  });
});

describe("storedStatusAfterChargeEdit", () => {
  it("edição sem pagamento preserva prevista", () => {
    expect(storedStatusAfterChargeEdit("prevista", 0, 1000)).toBe("prevista");
  });

  it("edição sem pagamento não força emitida", () => {
    expect(storedStatusAfterChargeEdit("prevista", 0, 500)).toBe("prevista");
  });

  it("permite alternar prevista ↔ emitida sem pagamento", () => {
    expect(storedStatusAfterChargeEdit("prevista", 0, 1000, "emitida")).toBe(
      "emitida",
    );
    expect(storedStatusAfterChargeEdit("emitida", 0, 1000, "prevista")).toBe(
      "prevista",
    );
  });
});
