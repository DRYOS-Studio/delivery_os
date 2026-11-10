import type { Database } from "@/lib/db/types";
import { calendarDateLocalToday } from "@/lib/utils/calendar-date";

export type ClientChargeStatus =
  Database["public"]["Enums"]["client_charge_status"];

export type ClientChargeStatusInput = {
  status: ClientChargeStatus;
  dueDate: string;
  netDue: number;
  paidAmount: number | null;
};

const OPEN_STATUSES: ReadonlySet<ClientChargeStatus> = new Set([
  "prevista",
  "emitida",
  "atrasada",
]);

function todayYmd(): string {
  return calendarDateLocalToday();
}

/** Status efetivo para UI e agregados (atrasada derivada). */
export function effectiveClientChargeStatus(
  input: ClientChargeStatusInput,
  asOfDate: string = todayYmd(),
): ClientChargeStatus {
  const paid = input.paidAmount ?? 0;
  if (input.status === "cancelada") return "cancelada";
  if (paid >= input.netDue && input.netDue > 0) return "paga";
  if (input.status === "paga" && paid >= input.netDue) return "paga";
  if (
    OPEN_STATUSES.has(input.status) &&
    input.dueDate < asOfDate &&
    paid < input.netDue
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
  return Math.max(0, input.netDue - paid);
}

/** Ex.: parcial quitado ou em atraso com saldo em aberto. */
export function clientChargeHasPartialPayment(input: ClientChargeStatusInput): boolean {
  const paid = input.paidAmount ?? 0;
  if (paid <= 0) return false;
  return paid < input.netDue;
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
