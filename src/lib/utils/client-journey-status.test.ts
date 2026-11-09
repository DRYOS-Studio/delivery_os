import { describe, expect, it } from "vitest";
import {
  CLIENT_JOURNEY_AUTOMATIC_TRANSITIONS,
  shouldAutoTransitionOnContractVigente,
  shouldAutoTransitionOnOnboardingEnded,
  shouldAutoTransitionOnOnboardingScheduled,
} from "@/lib/utils/client-journey-status";

describe("client journey automatic transitions", () => {
  it("contrato vigente só avança de etapas iniciais", () => {
    expect(shouldAutoTransitionOnContractVigente("onboarding_pendente")).toBe(true);
    expect(shouldAutoTransitionOnContractVigente("ativo")).toBe(false);
    expect(shouldAutoTransitionOnContractVigente("em_implantacao")).toBe(false);
    expect(CLIENT_JOURNEY_AUTOMATIC_TRANSITIONS.contract_vigente.to).toBe(
      "onboarding_pendente",
    );
  });

  it("reunião onboarding agendada só a partir de onboarding_pendente", () => {
    expect(shouldAutoTransitionOnOnboardingScheduled("onboarding_pendente")).toBe(true);
    expect(shouldAutoTransitionOnOnboardingScheduled("onboarding_agendado")).toBe(false);
  });

  it("reunião onboarding realizada leva a em_implantacao", () => {
    expect(shouldAutoTransitionOnOnboardingEnded("onboarding_agendado")).toBe(true);
    expect(shouldAutoTransitionOnOnboardingEnded("ativo")).toBe(false);
  });
});
