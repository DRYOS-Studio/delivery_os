import { describe, expect, it } from "vitest";
import { MCP_TOOL_DEFINITIONS } from "@/lib/mcp/tools/registry";
import {
  canHardDeleteClientCharge,
  canUndoClientChargePayment,
} from "@/lib/utils/client-charge-rules";
import type { ClientChargeRow } from "@/lib/db/queries/client-charges";

const baseCharge: ClientChargeRow = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
  clientId: "11111111-1111-4111-8111-111111111111",
  clientContractId: null,
  operationId: null,
  chargeType: "mensalidade",
  competence: "2026-01-01",
  dueDate: "2026-01-10",
  amount: 1000,
  discountKind: "fixed",
  discountInput: 100,
  discountAmount: 100,
  netDue: 900,
  status: "prevista",
  effectiveStatus: "prevista",
  openAmount: 900,
  paidAt: null,
  paidAmount: null,
  paymentMethod: null,
  notes: null,
  externalProvider: null,
  externalId: null,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

describe("MCP client charge tools", () => {
  it("registers lifecycle tools", () => {
    const names = MCP_TOOL_DEFINITIONS.map((t) => t.name);
    for (const name of [
      "update_client_charge",
      "delete_client_charge",
      "cancel_client_charge",
      "undo_client_charge_payment",
    ]) {
      expect(names, name).toContain(name);
    }
  });

  it("undo is blocked for gateway charges (agent guardrails)", () => {
    expect(canUndoClientChargePayment(baseCharge)).toBe(false);
    expect(
      canUndoClientChargePayment({
        status: "paga",
        paidAmount: 900,
        externalProvider: "stripe",
      }),
    ).toBe(false);
    expect(
      canUndoClientChargePayment({
        status: "paga",
        paidAmount: 900,
        externalProvider: null,
      }),
    ).toBe(true);
  });

  it("hard delete only without payment", () => {
    expect(canHardDeleteClientCharge(baseCharge)).toBe(true);
    expect(
      canHardDeleteClientCharge({ status: "paga", paidAmount: 1, externalProvider: null }),
    ).toBe(false);
  });
});
