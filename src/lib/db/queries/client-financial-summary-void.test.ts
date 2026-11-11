import { describe, expect, it } from "vitest";
import {
  computeBreakdown,
  isOperationCostInMonthlyBreakdown,
  type OperationCostRow,
} from "@/lib/db/queries/operation-costs";
import { computeMargin } from "@/lib/utils/margin";

describe("consolidado do cliente e custos anulados", () => {
  const today = "2026-11-11";
  const opId = "00000000-0000-4000-8000-000000000001";

  const activeItem: OperationCostRow = {
    id: "00000000-0000-4000-8000-000000000010",
    operationId: opId,
    label: "Vigente",
    category: "time",
    amount: 500,
    commissionPercent: null,
    monthlyAmount: 500,
    recurrence: "mensal",
    startedAt: "2026-01-01",
    endedAt: null,
    notes: null,
    createdAt: "",
    updatedAt: "",
  };

  const voidedDuplicateItem: OperationCostRow = {
    ...activeItem,
    id: "00000000-0000-4000-8000-000000000011",
    label: "Duplicata anulada",
    amount: 2000,
    monthlyAmount: 2000,
  };

  it("filtro SQL exclui voided_at preenchido", () => {
    expect(
      isOperationCostInMonthlyBreakdown(
        {
          voided_at: null,
          started_at: "2026-01-01",
          ended_at: null,
        },
        today,
      ),
    ).toBe(true);
    expect(
      isOperationCostInMonthlyBreakdown(
        {
          voided_at: "2026-11-10T12:00:00.000Z",
          started_at: "2026-01-01",
          ended_at: null,
        },
        today,
      ),
    ).toBe(false);
  });

  it("margem consolidada só considera custos que passariam no filtro", () => {
    const consolidated = computeBreakdown(
      opId,
      [activeItem],
      [],
      { chargedRevenue: 3000, taxRatePct: 0 },
    );
    const ifVoidedIncluded = computeBreakdown(
      opId,
      [activeItem, voidedDuplicateItem],
      [],
      { chargedRevenue: 3000, taxRatePct: 0 },
    );

    expect(consolidated.totalMonthly).toBe(500);
    expect(ifVoidedIncluded.totalMonthly).toBe(2500);

    const marginOk = computeMargin(3000, consolidated.totalMonthly);
    const marginWrong = computeMargin(3000, ifVoidedIncluded.totalMonthly);
    expect(marginOk.value).toBe(2500);
    expect(marginWrong.value).toBe(500);
  });
});
