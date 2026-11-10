import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";
import {
  clientChargeOpenAmount,
  effectiveClientChargeStatus,
  type ClientChargeStatus,
} from "@/lib/utils/client-charge-status";
import {
  buildPlannedChargesFromContract,
  DEFAULT_CHARGE_MONTHS_AHEAD,
  type ContractForChargeGeneration,
  type PlannedClientChargeInsert,
} from "@/lib/utils/generate-client-charges";
import { ACTIVE_STATUSES } from "@/lib/utils/operation-status";

export type ClientChargeType = Database["public"]["Enums"]["client_charge_type"];

export type ClientChargeRow = {
  id: string;
  clientId: string;
  clientContractId: string | null;
  operationId: string | null;
  chargeType: ClientChargeType;
  competence: string;
  dueDate: string;
  amount: number;
  status: ClientChargeStatus;
  effectiveStatus: ClientChargeStatus;
  openAmount: number;
  paidAt: string | null;
  paidAmount: number | null;
  paymentMethod: string | null;
  notes: string | null;
  externalProvider: string | null;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
};

type RawCharge = {
  id: string;
  client_id: string;
  client_contract_id: string | null;
  operation_id: string | null;
  charge_type: ClientChargeType;
  competence: string;
  due_date: string;
  amount: number | string;
  status: ClientChargeStatus;
  paid_at: string | null;
  paid_amount: number | string | null;
  payment_method: string | null;
  notes: string | null;
  external_provider: string | null;
  external_id: string | null;
  created_at: string;
  updated_at: string;
};

function mapCharge(r: RawCharge, asOf?: string): ClientChargeRow {
  const amount = Number(r.amount);
  const paidAmount =
    r.paid_amount === null || r.paid_amount === undefined
      ? null
      : Number(r.paid_amount);
  const statusInput = {
    status: r.status,
    dueDate: r.due_date,
    amount,
    paidAmount,
  };
  const effectiveStatus = effectiveClientChargeStatus(statusInput, asOf);
  return {
    id: r.id,
    clientId: r.client_id,
    clientContractId: r.client_contract_id,
    operationId: r.operation_id,
    chargeType: r.charge_type,
    competence: r.competence,
    dueDate: r.due_date,
    amount,
    status: r.status,
    effectiveStatus,
    openAmount: clientChargeOpenAmount(statusInput, asOf),
    paidAt: r.paid_at,
    paidAmount,
    paymentMethod: r.payment_method,
    notes: r.notes,
    externalProvider: r.external_provider,
    externalId: r.external_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const CHARGE_SELECT =
  "id, client_id, client_contract_id, operation_id, charge_type, competence, due_date, amount, status, paid_at, paid_amount, payment_method, notes, external_provider, external_id, created_at, updated_at";

export async function listClientCharges(
  clientId: string,
  opts?: { contractId?: string; limit?: number },
): Promise<ClientChargeRow[]> {
  const supabase = await createServer();
  let q = supabase
    .from("client_charges")
    .select(CHARGE_SELECT)
    .eq("client_id", clientId)
    .order("due_date", { ascending: false });
  if (opts?.contractId) {
    q = q.eq("client_contract_id", opts.contractId);
  }
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw new Error(`listClientCharges: ${error.message}`);
  return ((data ?? []) as RawCharge[]).map((r) => mapCharge(r));
}

export type ClientCashSummary = {
  asOfDate: string;
  monthStart: string;
  monthEnd: string;
  toReceiveThisMonth: number;
  receivedThisMonth: number;
  overdueTotal: number;
  registeredMrrThisMonth: number;
  plannedReceivableThisMonth: number;
  forecastNext3Months: { month: string; dueTotal: number }[];
  overdueItems: ClientChargeRow[];
};

function monthBounds(ref: string): { start: string; end: string } {
  const [y, m] = ref.split("-");
  const year = Number(y);
  const month = Number(m);
  const start = `${y}-${m}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export async function getGlobalClientCashSummary(
  asOfDate: string = new Date().toISOString().slice(0, 10),
): Promise<ClientCashSummary> {
  const supabase = await createServer();
  const { start, end } = monthBounds(asOfDate.slice(0, 7));

  const [chargesRes, contractsRes, opsRes] = await Promise.all([
    supabase
      .from("client_charges")
      .select(CHARGE_SELECT)
      .neq("status", "cancelada"),
    supabase
      .from("client_contracts")
      .select("monthly_value, status")
      .eq("status", "vigente"),
    supabase
      .from("operations")
      .select("monthly_recurring_revenue")
      .is("archived_at", null)
      .in("status", ACTIVE_STATUSES),
  ]);
  if (chargesRes.error)
    throw new Error(`getGlobalClientCashSummary: ${chargesRes.error.message}`);
  if (contractsRes.error)
    throw new Error(
      `getGlobalClientCashSummary.contracts: ${contractsRes.error.message}`,
    );
  if (opsRes.error)
    throw new Error(`getGlobalClientCashSummary.ops: ${opsRes.error.message}`);

  const charges = ((chargesRes.data ?? []) as RawCharge[]).map((r) =>
    mapCharge(r, asOfDate),
  );

  let toReceiveThisMonth = 0;
  let receivedThisMonth = 0;
  let overdueTotal = 0;
  const overdueItems: ClientChargeRow[] = [];
  const forecastMap = new Map<string, number>();

  for (const c of charges) {
    if (
      c.paidAt &&
      c.paidAt >= start &&
      c.paidAt <= end &&
      (c.paidAmount ?? 0) > 0
    ) {
      receivedThisMonth += c.paidAmount ?? 0;
    }
    if (c.dueDate >= start && c.dueDate <= end && c.openAmount > 0) {
      toReceiveThisMonth += c.openAmount;
    }
    if (c.effectiveStatus === "atrasada" && c.openAmount > 0) {
      overdueTotal += c.openAmount;
      overdueItems.push(c);
    }
    if (c.openAmount > 0) {
      const monthKey = c.dueDate.slice(0, 7);
      forecastMap.set(monthKey, (forecastMap.get(monthKey) ?? 0) + c.openAmount);
    }
  }

  const registeredMrrThisMonth = (opsRes.data ?? []).reduce((s, o) => {
    const v = o.monthly_recurring_revenue;
    return s + (v === null || v === undefined ? 0 : Number(v));
  }, 0);

  const plannedReceivableThisMonth = (contractsRes.data ?? []).reduce((s, c) => {
    const v = c.monthly_value;
    return s + (v === null || v === undefined ? 0 : Number(v));
  }, 0);

  const baseYm = asOfDate.slice(0, 7);
  const [by, bm] = baseYm.split("-").map(Number);
  const forecastNext3Months: { month: string; dueTotal: number }[] = [];
  for (let i = 0; i < 3; i += 1) {
    const idx = (by ?? 0) * 12 + ((bm ?? 1) - 1) + i;
    const y = Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    const key = `${y}-${String(m).padStart(2, "0")}`;
    forecastNext3Months.push({
      month: key,
      dueTotal: forecastMap.get(key) ?? 0,
    });
  }

  overdueItems.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return {
    asOfDate,
    monthStart: start,
    monthEnd: end,
    toReceiveThisMonth,
    receivedThisMonth,
    overdueTotal,
    registeredMrrThisMonth,
    plannedReceivableThisMonth,
    forecastNext3Months,
    overdueItems: overdueItems.slice(0, 20),
  };
}

export async function getClientContractForCharges(
  contractId: string,
): Promise<ContractForChargeGeneration | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("client_contracts")
    .select(
      "id, client_id, status, monthly_value, implementation_fee, implementation_fee_paid, first_billing_date, start_date, end_date, payment_day_of_month",
    )
    .eq("id", contractId)
    .maybeSingle();
  if (error) throw new Error(`getClientContractForCharges: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    clientId: data.client_id,
    status: data.status,
    monthlyValue:
      data.monthly_value === null ? null : Number(data.monthly_value),
    implementationFee:
      data.implementation_fee === null ? null : Number(data.implementation_fee),
    implementationFeePaid: data.implementation_fee_paid,
    firstBillingDate: data.first_billing_date,
    startDate: data.start_date,
    endDate: data.end_date,
    paymentDayOfMonth: data.payment_day_of_month,
  };
}

async function pickOperationForClient(
  clientId: string,
): Promise<string | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("operations")
    .select("id")
    .eq("client_id", clientId)
    .is("archived_at", null)
    .in("status", ACTIVE_STATUSES)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`pickOperationForClient: ${error.message}`);
  return data?.id ?? null;
}

export type GenerateChargesResult = {
  inserted: number;
  skipped: number;
  chargeIds: string[];
};

export async function generateClientChargesFromContract(
  contractId: string,
  monthsAhead: number = DEFAULT_CHARGE_MONTHS_AHEAD,
): Promise<GenerateChargesResult> {
  const contract = await getClientContractForCharges(contractId);
  if (!contract) throw new Error("Contrato não encontrado.");
  const operationId = await pickOperationForClient(contract.clientId);
  const planned = buildPlannedChargesFromContract(
    contract,
    operationId,
    monthsAhead,
  );
  if (planned.length === 0) {
    return { inserted: 0, skipped: 0, chargeIds: [] };
  }

  const supabase = await createServer();
  let inserted = 0;
  let skipped = 0;
  const chargeIds: string[] = [];

  for (const row of planned) {
    const { data, error } = await supabase
      .from("client_charges")
      .insert(row)
      .select("id")
      .maybeSingle();
    if (error) {
      if (error.code === "23505") {
        skipped += 1;
        continue;
      }
      throw new Error(`generateClientChargesFromContract: ${error.message}`);
    }
    if (data?.id) {
      inserted += 1;
      chargeIds.push(data.id);
    }
  }

  return { inserted, skipped, chargeIds };
}

export async function markClientChargePaid(
  chargeId: string,
  input: {
    paidAt: string;
    paidAmount: number;
    paymentMethod: string | null;
  },
): Promise<ClientChargeRow> {
  const supabase = await createServer();
  const { data: existing, error: getErr } = await supabase
    .from("client_charges")
    .select(CHARGE_SELECT)
    .eq("id", chargeId)
    .maybeSingle();
  if (getErr) throw new Error(`markClientChargePaid: ${getErr.message}`);
  if (!existing) throw new Error("Cobrança não encontrada.");

  const amount = Number(existing.amount);
  const status: ClientChargeStatus =
    input.paidAmount >= amount ? "paga" : existing.status;

  const { data, error } = await supabase
    .from("client_charges")
    .update({
      paid_at: input.paidAt,
      paid_amount: input.paidAmount,
      payment_method: input.paymentMethod,
      status,
    })
    .eq("id", chargeId)
    .select(CHARGE_SELECT)
    .single();
  if (error) throw new Error(`markClientChargePaid.update: ${error.message}`);
  return mapCharge(data as RawCharge);
}
