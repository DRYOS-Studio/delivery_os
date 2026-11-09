import { describe, expect, it } from "vitest";
import {
  CLIENT_JOURNEY_AUTOMATIC_TRANSITIONS,
  CLIENT_JOURNEY_BACKFILL_PRECEDENCE,
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

describe("backfill jornada (precedência migration)", () => {
  it("documenta a ordem aprovada para clientes existentes", () => {
    expect(CLIENT_JOURNEY_BACKFILL_PRECEDENCE).toEqual([
      "encerrado_se_arquivado",
      "ativo_se_operacao_ativa",
      "em_implantacao_ou_onboarding_agendado_sem_op_ativa",
      "onboarding_pendente_contrato_ou_resto",
    ]);
  });
});
