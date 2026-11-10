import type { ClientChargeStatus } from "@/lib/utils/client-charge-status";

export type ChargePaymentSnapshot = {
  status: ClientChargeStatus;
  paidAmount: number | null;
  externalProvider: string | null;
};

export function chargeHasPaymentRecorded(
  charge: ChargePaymentSnapshot,
): boolean {
  const paid = charge.paidAmount ?? 0;
  return paid > 0 || charge.status === "paga";
}

export function canHardDeleteClientCharge(
  charge: ChargePaymentSnapshot,
): boolean {
  return !chargeHasPaymentRecorded(charge);
}

export function canUndoClientChargePayment(
  charge: ChargePaymentSnapshot,
): boolean {
  if (!chargeHasPaymentRecorded(charge)) return false;
  if (charge.externalProvider !== null && charge.externalProvider.trim() !== "") {
    return false;
  }
  return true;
}

/** Status armazenado após desfazer recebimento total (sem pagamento restante). */
export function statusAfterUndoFullPayment(
  previousStoredStatus: ClientChargeStatus,
): ClientChargeStatus {
  if (previousStoredStatus === "cancelada") return "cancelada";
  return previousStoredStatus === "emitida" ? "emitida" : "prevista";
}

/** Status armazenado quando ainda há pagamento parcial. */
export function statusAfterPartialPayment(
  paidAmount: number,
  netDue: number,
): ClientChargeStatus {
  if (paidAmount >= netDue) return "paga";
  return "emitida";
}
