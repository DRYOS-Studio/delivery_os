import type { Database } from "@/lib/db/types";

export type ClientChargeType = Database["public"]["Enums"]["client_charge_type"];
export type ClientContractStatus =
  Database["public"]["Enums"]["client_contract_status"];

export type ContractForChargeGeneration = {
  id: string;
  clientId: string;
  status: ClientContractStatus;
  monthlyValue: number | null;
  implementationFee: number | null;
  implementationFeePaid: boolean;
  firstBillingDate: string | null;
  startDate: string | null;
  endDate: string | null;
  paymentDayOfMonth: number | null;
};

export type PlannedClientChargeInsert = {
  client_id: string;
  client_contract_id: string;
  operation_id: string | null;
  charge_type: ClientChargeType;
  competence: string;
  due_date: string;
  amount: number;
  status: "prevista" | "paga";
  paid_at: string | null;
  paid_amount: number | null;
  notes: string | null;
};

export const DEFAULT_CHARGE_MONTHS_AHEAD = 12;

function parseYmd(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  return { y: y ?? 0, m: m ?? 0, d: d ?? 0 };
}

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function firstOfMonth(y: number, m: number): string {
  return ymd(y, m, 1);
}

function addMonths(y: number, m: number, delta: number): { y: number; m: number } {
  const idx = y * 12 + (m - 1) + delta;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

function clampDay(year: number, month: number, day: number): number {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Math.min(Math.max(day, 1), last);
}

function dueDateInMonth(
  year: number,
  month: number,
  paymentDay: number,
  fallbackYmd: string,
): string {
  const day = clampDay(year, month, paymentDay);
  const candidate = ymd(year, month, day);
  return candidate < fallbackYmd ? fallbackYmd : candidate;
}

function monthStartFromAnchor(anchor: string): { y: number; m: number } {
  const { y, m } = parseYmd(anchor);
  return { y, m };
}

export function buildPlannedChargesFromContract(
  contract: ContractForChargeGeneration,
  operationId: string | null,
  monthsAhead: number = DEFAULT_CHARGE_MONTHS_AHEAD,
): PlannedClientChargeInsert[] {
  if (contract.status !== "vigente") return [];

  const rows: PlannedClientChargeInsert[] = [];
  const anchor = contract.firstBillingDate ?? contract.startDate;
  if (!anchor) return rows;

  const base = {
    client_id: contract.clientId,
    client_contract_id: contract.id,
    operation_id: operationId,
    notes: null as string | null,
  };

  const fee = contract.implementationFee ?? 0;
  if (fee > 0) {
    const competence = anchor;
    const paid = contract.implementationFeePaid;
    const { y: cy, m: cm } = monthStartFromAnchor(competence);
    rows.push({
      ...base,
      charge_type: "implantacao",
      competence: firstOfMonth(cy, cm),
      due_date: contract.firstBillingDate ?? contract.startDate ?? competence,
      amount: fee,
      status: paid ? "paga" : "prevista",
      paid_at: paid ? (contract.firstBillingDate ?? contract.startDate ?? competence) : null,
      paid_amount: paid ? fee : null,
    });
  }

  const monthly = contract.monthlyValue ?? 0;
  if (monthly > 0) {
    const paymentDay =
      contract.paymentDayOfMonth ?? parseYmd(anchor).d;
    const start = monthStartFromAnchor(anchor);
    const endDate = contract.endDate;

    for (let i = 0; i < monthsAhead; i += 1) {
      const { y, m } = addMonths(start.y, start.m, i);
      const competence = firstOfMonth(y, m);
      if (competence < firstOfMonth(start.y, start.m)) continue;
      if (endDate && competence > endDate) break;

      const minDue = i === 0 ? anchor : competence;
      rows.push({
        ...base,
        charge_type: "mensalidade",
        competence,
        due_date: dueDateInMonth(y, m, paymentDay, minDue),
        amount: monthly,
        status: "prevista",
        paid_at: null,
        paid_amount: null,
      });
    }
  }

  return rows;
}

/** Chave lógica para deduplicar inserções. */
export function plannedChargeKey(row: PlannedClientChargeInsert): string {
  return `${row.client_contract_id}:${row.charge_type}:${row.competence}`;
}

export function mergeIdempotentPlannedCharges(
  existing: PlannedClientChargeInsert[],
  generated: PlannedClientChargeInsert[],
): PlannedClientChargeInsert[] {
  const keys = new Set(existing.map(plannedChargeKey));
  const out = [...existing];
  for (const row of generated) {
    const key = plannedChargeKey(row);
    if (keys.has(key)) continue;
    keys.add(key);
    out.push(row);
  }
  return out;
}
