import { describe, expect, it } from "vitest";
import {
  contractMrrMismatch,
  earliestIsoDate,
  sumVigenteContractMonthly,
} from "@/lib/utils/client-financial-helpers";

describe("client financial helpers", () => {
  it("soma apenas contratos vigentes", () => {
    expect(
      sumVigenteContractMonthly([
        { status: "vigente", monthlyValue: 1000 },
        { status: "rascunho", monthlyValue: 500 },
        { status: "vigente", monthlyValue: 500 },
      ]),
    ).toBe(1500);
  });

  it("detecta divergência contrato × MRR", () => {
    expect(contractMrrMismatch(3000, 2500)).toBe(true);
    expect(contractMrrMismatch(3000, 3000)).toBe(false);
  });

  it("escolhe a data mais antiga", () => {
    expect(
      earliestIsoDate(["2026-11-15", null, "2025-01-01", "2026-01-01"]),
    ).toBe("2025-01-01");
  });
});
