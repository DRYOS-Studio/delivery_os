import { describe, expect, it } from "vitest";
import type { OperationCardData } from "@/lib/db/queries/operations";
import { pickOnboardingScheduleHref } from "@/lib/utils/client-onboarding-schedule";

const clientId = "5d7942fe-577c-45f4-853f-822c49cbdba6";

function op(
  partial: Pick<OperationCardData, "id" | "status"> &
    Partial<OperationCardData>,
): OperationCardData {
  return {
    id: partial.id,
    status: partial.status,
    clientName: "Acme",
    operationName: "Core",
    productLine: "core",
    firstFrente: null,
    teamSize: 0,
    ...partial,
  };
}

describe("pickOnboardingScheduleHref", () => {
  it("ignora operação terminal com uma só visível", () => {
    expect(
      pickOnboardingScheduleHref(clientId, [
        op({ id: "881c0252-a269-4296-8af3-d235b3c78efc", status: "concluida" }),
      ]),
    ).toBeNull();
  });

  it("vai direto para meetings/new com uma operação ativa", () => {
    const href = pickOnboardingScheduleHref(clientId, [
      op({ id: "881c0252-a269-4296-8af3-d235b3c78efc", status: "em_operacao" }),
    ]);
    expect(href).toBe(
      `/operations/881c0252-a269-4296-8af3-d235b3c78efc/meetings/new?kind=onboarding&returnTo=%2Fclients%2F${clientId}`,
    );
  });

  it("abre picker quando há mais de uma operação ativa", () => {
    expect(
      pickOnboardingScheduleHref(clientId, [
        op({ id: "a", status: "em_operacao" }),
        op({ id: "b", status: "em_construcao" }),
      ]),
    ).toBe(
      `/clients/${clientId}/onboarding?returnTo=%2Fclients%2F${clientId}`,
    );
  });
});