import type { PillVariant } from "@/components/ui/Pill";
import type { Database } from "@/lib/db/types";

export type ClientJourneyStatus =
  Database["public"]["Enums"]["client_journey_status"];

type StatusMeta = {
  label: string;
  variant: PillVariant;
  /** Transições manuais permitidas no painel. */
  manual: boolean;
};

const JOURNEY_STATUS: Record<ClientJourneyStatus, StatusMeta> = {
  em_cadastro: {
    label: "Em cadastro",
    variant: "neutral",
    manual: true,
  },
  onboarding_pendente: {
    label: "Onboarding pendente",
    variant: "warning",
    manual: true,
  },
  onboarding_agendado: {
    label: "Onboarding agendado",
    variant: "sage",
    manual: true,
  },
  em_implantacao: {
    label: "Em implantação",
    variant: "neutral",
    manual: true,
  },
  ativo: {
    label: "Ativo",
    variant: "ok",
    manual: true,
  },
  pausado: {
    label: "Pausado",
    variant: "warning",
    manual: true,
  },
  encerrado: {
    label: "Encerrado",
    variant: "critical",
    manual: true,
  },
};

const ALL = Object.keys(JOURNEY_STATUS) as ClientJourneyStatus[];

export function clientJourneyLabel(status: ClientJourneyStatus): string {
  return JOURNEY_STATUS[status].label;
}

export function clientJourneyVariant(status: ClientJourneyStatus): PillVariant {
  return JOURNEY_STATUS[status].variant;
}

export function clientJourneyOptionsForManualSelect(): ReadonlyArray<{
  value: ClientJourneyStatus;
  label: string;
}> {
  return ALL.map((value) => ({
    value,
    label: JOURNEY_STATUS[value].label,
  }));
}

export function isClientJourneyStatus(value: string): value is ClientJourneyStatus {
  return (ALL as string[]).includes(value);
}

/**
 * Transições automáticas (espelho dos triggers SQL). Usado em testes.
 */
/** Ordem do backfill em `20261109230000_client_journey_and_meeting_kind.sql`. */
export const CLIENT_JOURNEY_BACKFILL_PRECEDENCE = [
  "encerrado_se_arquivado",
  "ativo_se_operacao_ativa",
  "em_implantacao_ou_onboarding_agendado_sem_op_ativa",
  "onboarding_pendente_contrato_ou_resto",
] as const;

export const CLIENT_JOURNEY_AUTOMATIC_TRANSITIONS = {
  contract_vigente: {
    to: "onboarding_pendente" as const,
    from: ["em_cadastro", "onboarding_pendente", "onboarding_agendado"] as const,
  },
  onboarding_meeting_scheduled: {
    to: "onboarding_agendado" as const,
    from: ["onboarding_pendente"] as const,
  },
  onboarding_meeting_ended: {
    to: "em_implantacao" as const,
    from: ["onboarding_pendente", "onboarding_agendado"] as const,
  },
  registration_approved: {
    to: "onboarding_pendente" as const,
    from: ["new_client"] as const,
  },
} as const;

export function shouldAutoTransitionOnContractVigente(
  current: ClientJourneyStatus,
): boolean {
  return (
    CLIENT_JOURNEY_AUTOMATIC_TRANSITIONS.contract_vigente.from as readonly string[]
  ).includes(current);
}

export function shouldAutoTransitionOnOnboardingScheduled(
  current: ClientJourneyStatus,
): boolean {
  return current === "onboarding_pendente";
}

export function shouldAutoTransitionOnOnboardingEnded(
  current: ClientJourneyStatus,
): boolean {
  return (
    CLIENT_JOURNEY_AUTOMATIC_TRANSITIONS.onboarding_meeting_ended.from as readonly string[]
  ).includes(current);
}
