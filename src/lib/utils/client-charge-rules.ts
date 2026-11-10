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

export type ChargeBillingStatus = "prevista" | "emitida";

export function canSetChargeBillingStatus(status: ClientChargeStatus): boolean {
  return status === "prevista" || status === "emitida";
}

/** Status persistido ao editar cobrança (sem forçar emitida quando ainda não houve pagamento). */
export function storedStatusAfterChargeEdit(
  previous: ClientChargeStatus,
  paidAmount: number,
  netDue: number,
  requestedStatus?: ChargeBillingStatus,
): ClientChargeStatus {
  if (previous === "cancelada" || previous === "paga") {
    return previous;
  }
  if (paidAmount > 0) {
    return statusAfterPartialPayment(paidAmount, netDue);
  }
  if (
    requestedStatus &&
    canSetChargeBillingStatus(previous) &&
    canSetChargeBillingStatus(requestedStatus)
  ) {
    return requestedStatus;
  }
  if (previous === "prevista" || previous === "emitida") {
    return previous;
  }
  return previous;
}
