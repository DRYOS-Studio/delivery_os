import type { OperationCardData } from "@/lib/db/queries/operations";
import { isActiveStatus } from "@/lib/utils/operation-status";

/**
 * Destino do CTA "Agendar onboarding" na visão do Cliente.
 * Só considera Operações com status ativo — terminal não recebe reunião nova.
 */
export function pickOnboardingScheduleHref(
  clientId: string,
  operations: OperationCardData[],
): string | null {
  const returnTo = encodeURIComponent(`/clients/${clientId}`);
  const schedulable = operations.filter((op) => isActiveStatus(op.status));

  if (schedulable.length === 1) {
    const op = schedulable[0];
    if (!op) return null;
    return `/operations/${op.id}/meetings/new?kind=onboarding&returnTo=${returnTo}`;
  }
  if (schedulable.length > 1) {
    return `/clients/${clientId}/onboarding?returnTo=${returnTo}`;
  }
  return null;
}