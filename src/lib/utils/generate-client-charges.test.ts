import { describe, expect, it } from "vitest";
import {
  buildPlannedChargesFromContract,
  mergeIdempotentPlannedCharges,
  plannedChargeKey,
  type PlannedClientChargeInsert,
} from "@/lib/utils/generate-client-charges";

const contractBase = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  clientId: "11111111-1111-4111-8111-111111111111",
  status: "vigente" as const,
  monthlyValue: 3000,
  implementationFee: 1000,
  implementationFeePaid: false,
  firstBillingDate: "2026-01-15",
  startDate: "2026-01-01",
  endDate: null,
  paymentDayOfMonth: 10,
};

describe("buildPlannedChargesFromContract", () => {
  it("gera implantação e 12 mensalidades com vencimento no dia do contrato", () => {
    const rows = buildPlannedChargesFromContract(contractBase, null, 12);
    const impl = rows.find((r) => r.charge_type === "implantacao");
    expect(impl?.amount).toBe(1000);
    expect(impl?.due_date).toBe("2026-01-15");
    const monthly = rows.filter((r) => r.charge_type === "mensalidade");
    expect(monthly).toHaveLength(12);
    expect(monthly[0]?.due_date).toBe("2026-01-15");
    expect(monthly[1]?.due_date).toBe("2026-02-10");
    expect(monthly[0]?.amount).toBe(3000);
  });

  it("idempotência: mesclar não duplica chave contrato+tipo+competência", () => {
    const first = buildPlannedChargesFromContract(contractBase, null, 3);
    const second = buildPlannedChargesFromContract(contractBase, null, 6);
    const merged = mergeIdempotentPlannedCharges(first, second);
    const keys = new Set(merged.map(plannedChargeKey));
    expect(keys.size).toBe(merged.length);
    expect(merged.filter((r) => r.charge_type === "mensalidade")).toHaveLength(6);
  });

  it("respeita end_date no vencimento (não gera mensalidade após fim)", () => {
    const rows = buildPlannedChargesFromContract(
      {
        ...contractBase,
        firstBillingDate: "2026-10-26",
        startDate: "2026-10-25",
        endDate: "2027-04-24",
        paymentDayOfMonth: 26,
        implementationFee: 0,
        monthlyValue: 500,
      },
      null,
      12,
    );
    const monthly = rows.filter((r) => r.charge_type === "mensalidade");
    expect(monthly.map((r) => r.due_date)).toEqual([
      "2026-10-26",
      "2026-11-26",
      "2026-12-26",
      "2027-01-26",
      "2027-02-26",
      "2027-03-26",
    ]);
  });

  it("months_ahead limita competências a partir da 1ª cobrança", () => {
    const rows = buildPlannedChargesFromContract(
      {
        ...contractBase,
        firstBillingDate: "2026-10-26",
        startDate: "2026-10-25",
        endDate: "2027-04-24",
        paymentDayOfMonth: 26,
        implementationFee: 0,
        monthlyValue: 500,
      },
      null,
      6,
    );
    expect(
      rows.filter((r) => r.charge_type === "mensalidade").map((r) => r.due_date),
    ).toHaveLength(6);
  });

  it("implantação quitada no contrato nasce como paga", () => {
    const rows = buildPlannedChargesFromContract(
      { ...contractBase, implementationFeePaid: true },
      null,
      1,
    );
    const impl = rows.find((r) => r.charge_type === "implantacao");
    expect(impl?.status).toBe("paga");
    expect(impl?.paid_amount).toBe(1000);
  });
});

describe("plannedChargeKey", () => {
  it("formato estável", () => {
    const row: PlannedClientChargeInsert = {
      client_id: "a",
      client_contract_id: "b",
      operation_id: null,
      charge_type: "mensalidade",
      competence: "2026-02-01",
      due_date: "2026-02-10",
      amount: 1,
      status: "prevista",
      paid_at: null,
      paid_amount: null,
      notes: null,
    };
    expect(plannedChargeKey(row)).toBe("b:mensalidade:2026-02-01");
  });
});
