import type { Database } from "@/lib/db/types";

export type ClientChargeStatus =
  Database["public"]["Enums"]["client_charge_status"];

export type ClientChargeStatusInput = {
  status: ClientChargeStatus;
  dueDate: string;
  amount: number;
  paidAmount: number | null;
};

const OPEN_STATUSES: ReadonlySet<ClientChargeStatus> = new Set([
  "prevista",
  "emitida",
  "atrasada",
]);

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Status efetivo para UI e agregados (atrasada derivada). */
export function effectiveClientChargeStatus(
  input: ClientChargeStatusInput,
  asOfDate: string = todayYmd(),
): ClientChargeStatus {
  const paid = input.paidAmount ?? 0;
  if (input.status === "cancelada") return "cancelada";
  if (paid >= input.amount) return "paga";
  if (input.status === "paga") return "paga";
  if (
    OPEN_STATUSES.has(input.status) &&
    input.dueDate < asOfDate &&
    paid < input.amount
  ) {
    return "atrasada";
  }
  return input.status;
}

export function clientChargeOpenAmount(
  input: ClientChargeStatusInput,
  asOfDate?: string,
): number {
  const effective = effectiveClientChargeStatus(input, asOfDate);
  if (effective === "cancelada" || effective === "paga") return 0;
  const paid = input.paidAmount ?? 0;
  return Math.max(0, input.amount - paid);
}

export function clientChargeStatusLabel(status: ClientChargeStatus): string {
  switch (status) {
    case "prevista":
      return "Prevista";
    case "emitida":
      return "Emitida";
    case "paga":
      return "Paga";
    case "atrasada":
      return "Atrasada";
    case "cancelada":
      return "Cancelada";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
