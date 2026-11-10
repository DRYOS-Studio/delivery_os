import type { Database } from "@/lib/db/types";

export type ClientChargeDiscountKind =
  Database["public"]["Enums"]["client_charge_discount_kind"];

export function computeDiscountAmount(
  grossAmount: number,
  kind: ClientChargeDiscountKind,
  input: number | null,
): number {
  if (grossAmount <= 0 || kind === "none") return 0;
  if (input === null || input === undefined || input <= 0) return 0;
  if (kind === "fixed") return Math.min(grossAmount, input);
  if (kind === "percent") {
    return Math.min(grossAmount, (grossAmount * input) / 100);
  }
  const _exhaustive: never = kind;
  return _exhaustive;
}

export function clientChargeNetDue(
  grossAmount: number,
  discountAmount: number,
): number {
  return Math.max(0, grossAmount - Math.max(0, discountAmount));
}

export function resolveStoredDiscountAmount(
  grossAmount: number,
  kind: ClientChargeDiscountKind,
  input: number | null,
  storedAmount: number,
): number {
  const computed = computeDiscountAmount(grossAmount, kind, input);
  if (kind === "none") return 0;
  return storedAmount > 0 ? storedAmount : computed;
}
