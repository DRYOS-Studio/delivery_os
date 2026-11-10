import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clientChargeNetDue,
  computeDiscountAmount,
  resolveStoredDiscountAmount,
  type ClientChargeDiscountKind,
} from "@/lib/utils/client-charge-amount";
import {
  canHardDeleteClientCharge,
  canUndoClientChargePayment,
  statusAfterPartialPayment,
  statusAfterUndoFullPayment,
} from "@/lib/utils/client-charge-rules";
import {
  clientChargeOpenAmount,
  effectiveClientChargeStatus,
  type ClientChargeStatus,
} from "@/lib/utils/client-charge-status";
import {
  buildPlannedChargesFromContract,
  DEFAULT_CHARGE_MONTHS_AHEAD,
  plannedChargeKey,
  type ContractForChargeGeneration,
  type PlannedClientChargeInsert,
} from "@/lib/utils/generate-client-charges";
import { calendarDateLocalToday } from "@/lib/utils/calendar-date";
import {
  storedStatusAfterChargeEdit,
  type ChargeBillingStatus,
} from "@/lib/utils/client-charge-rules";
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
  discountKind: ClientChargeDiscountKind;
  discountInput: number | null;
  discountAmount: number;
  netDue: number;
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
  discount_kind?: ClientChargeDiscountKind;
  discount_input?: number | string | null;
  discount_amount?: number | string | null;
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
  const discountKind = (r.discount_kind ?? "none") as ClientChargeDiscountKind;
  const discountInput =
    r.discount_input === null || r.discount_input === undefined
      ? null
      : Number(r.discount_input);
  const discountAmount = resolveStoredDiscountAmount(
    amount,
    discountKind,
    discountInput,
    Number(r.discount_amount ?? 0),
  );
  const netDue = clientChargeNetDue(amount, discountAmount);
  const paidAmount =
    r.paid_amount === null || r.paid_amount === undefined
      ? null
      : Number(r.paid_amount);
  const statusInput = {
    status: r.status,
    dueDate: r.due_date,
    netDue,
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
    discountKind,
    discountInput,
    discountAmount,
    netDue,
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
  "id, client_id, client_contract_id, operation_id, charge_type, competence, due_date, amount, discount_kind, discount_input, discount_amount, status, paid_at, paid_amount, payment_method, notes, external_provider, external_id, created_at, updated_at";

export async function getClientCharge(
  id: string,
  supabase?: SupabaseClient<Database>,
): Promise<ClientChargeRow | null> {
  const db = await resolveSupabase(supabase);
  const { data, error } = await db
    .from("client_charges")
    .select(CHARGE_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getClientCharge: ${error.message}`);
  if (!data) return null;
  return mapCharge(data as RawCharge);
}

export async function listClientCharges(
  clientId: string,
  opts?: { contractId?: string; limit?: number },
  supabase?: SupabaseClient<Database>,
): Promise<ClientChargeRow[]> {
  const db = await resolveSupabase(supabase);
  let q = db
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
  asOfDate: string = calendarDateLocalToday(),
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

async function resolveSupabase(
  supabase?: SupabaseClient<Database>,
): Promise<SupabaseClient<Database>> {
  return supabase ?? (await createServer());
}

export async function getClientContractForCharges(
  contractId: string,
  supabase?: SupabaseClient<Database>,
): Promise<ContractForChargeGeneration | null> {
  const db = await resolveSupabase(supabase);
  const { data, error } = await db
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
  supabase?: SupabaseClient<Database>,
): Promise<string | null> {
  const db = await resolveSupabase(supabase);
  const { data, error } = await db
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

const EXISTING_CHARGE_SLOT_SELECT =
  "id, charge_type, competence, status";

type ExistingChargeSlot = {
  id: string;
  charge_type: ClientChargeType;
  competence: string;
  status: ClientChargeStatus;
};

async function loadExistingChargeSlotsByContract(
  db: SupabaseClient<Database>,
  contractId: string,
): Promise<Map<string, ExistingChargeSlot>> {
  const { data, error } = await db
    .from("client_charges")
    .select(EXISTING_CHARGE_SLOT_SELECT)
    .eq("client_contract_id", contractId);
  if (error) {
    throw new Error(
      `generateClientChargesFromContract.existing: ${error.message}`,
    );
  }
  const map = new Map<string, ExistingChargeSlot>();
  for (const raw of (data ?? []) as ExistingChargeSlot[]) {
    const key = `${contractId}:${raw.charge_type}:${raw.competence}`;
    map.set(key, raw);
  }
  return map;
}

async function removeCancelledChargeSlot(
  db: SupabaseClient<Database>,
  existing: ExistingChargeSlot,
): Promise<void> {
  const { error } = await db.from("client_charges").delete().eq("id", existing.id);
  if (error) {
    throw new Error(
      `generateClientChargesFromContract.removeCancelled: ${error.message}`,
    );
  }
}

async function resolveUniqueViolation(
  db: SupabaseClient<Database>,
  row: PlannedClientChargeInsert,
): Promise<ExistingChargeSlot | null> {
  const { data, error } = await db
    .from("client_charges")
    .select(EXISTING_CHARGE_SLOT_SELECT)
    .eq("client_contract_id", row.client_contract_id)
    .eq("charge_type", row.charge_type)
    .eq("competence", row.competence)
    .maybeSingle();
  if (error) {
    throw new Error(
      `generateClientChargesFromContract.conflict: ${error.message}`,
    );
  }
  return data ? (data as ExistingChargeSlot) : null;
}

export async function generateClientChargesFromContract(
  contractId: string,
  monthsAhead: number = DEFAULT_CHARGE_MONTHS_AHEAD,
  supabase?: SupabaseClient<Database>,
): Promise<GenerateChargesResult> {
  const contract = await getClientContractForCharges(contractId, supabase);
  if (!contract) throw new Error("Contrato não encontrado.");
  const operationId = await pickOperationForClient(contract.clientId, supabase);
  const planned = buildPlannedChargesFromContract(
    contract,
    operationId,
    monthsAhead,
  );
  if (planned.length === 0) {
    return { inserted: 0, skipped: 0, chargeIds: [] };
  }

  const db = await resolveSupabase(supabase);
  const existingByKey = await loadExistingChargeSlotsByContract(db, contractId);
  let inserted = 0;
  let skipped = 0;
  const chargeIds: string[] = [];

  for (const row of planned) {
    const key = plannedChargeKey(row);
    const existing = existingByKey.get(key);
    if (existing && existing.status !== "cancelada") {
      skipped += 1;
      continue;
    }
    if (existing?.status === "cancelada") {
      await removeCancelledChargeSlot(db, existing);
      existingByKey.delete(key);
    }

    const { data, error } = await db
      .from("client_charges")
      .insert(row)
      .select("id")
      .maybeSingle();
    if (error) {
      if (error.code === "23505") {
        const conflict = await resolveUniqueViolation(db, row);
        if (conflict && conflict.status !== "cancelada") {
          existingByKey.set(key, conflict);
          skipped += 1;
          continue;
        }
      }
      throw new Error(`generateClientChargesFromContract: ${error.message}`);
    }
    if (data?.id) {
      inserted += 1;
      chargeIds.push(data.id);
      existingByKey.set(key, {
        id: data.id,
        charge_type: row.charge_type,
        competence: row.competence,
        status: "prevista",
      });
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
  supabase?: SupabaseClient<Database>,
): Promise<ClientChargeRow> {
  const db = await resolveSupabase(supabase);
  const { data: existing, error: getErr } = await db
    .from("client_charges")
    .select(CHARGE_SELECT)
    .eq("id", chargeId)
    .maybeSingle();
  if (getErr) throw new Error(`markClientChargePaid: ${getErr.message}`);
  if (!existing) throw new Error("Cobrança não encontrada.");

  const row = mapCharge(existing as RawCharge);
  const status = statusAfterPartialPayment(input.paidAmount, row.netDue);

  const { data, error } = await db
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

export type UpdateClientChargeInput = {
  amount: number;
  dueDate: string;
  notes: string | null;
  discountKind: ClientChargeDiscountKind;
  discountInput: number | null;
  status?: ChargeBillingStatus;
};

export async function updateClientCharge(
  chargeId: string,
  input: UpdateClientChargeInput,
  supabase?: SupabaseClient<Database>,
): Promise<ClientChargeRow> {
  const discountAmount = computeDiscountAmount(
    input.amount,
    input.discountKind,
    input.discountInput,
  );
  const db = await resolveSupabase(supabase);
  const { data: existing, error: getErr } = await db
    .from("client_charges")
    .select(CHARGE_SELECT)
    .eq("id", chargeId)
    .maybeSingle();
  if (getErr) throw new Error(`updateClientCharge: ${getErr.message}`);
  if (!existing) throw new Error("Cobrança não encontrada.");

  const mapped = mapCharge(existing as RawCharge);
  const netDue = clientChargeNetDue(input.amount, discountAmount);
  const paid = mapped.paidAmount ?? 0;
  if (
    input.status !== undefined &&
    (paid > 0 || mapped.status === "paga" || mapped.status === "cancelada")
  ) {
    throw new Error(
      "Status prevista/emitida só pode ser alterado em cobranças sem pagamento.",
    );
  }
  const status = storedStatusAfterChargeEdit(
    mapped.status,
    paid,
    netDue,
    input.status,
  );

  const { data, error } = await db
    .from("client_charges")
    .update({
      amount: input.amount,
      due_date: input.dueDate,
      notes: input.notes,
      discount_kind: input.discountKind,
      discount_input: input.discountKind === "none" ? null : input.discountInput,
      discount_amount: discountAmount,
      status,
    })
    .eq("id", chargeId)
    .select(CHARGE_SELECT)
    .single();
  if (error) throw new Error(`updateClientCharge.update: ${error.message}`);
  return mapCharge(data as RawCharge);
}

export async function deleteClientCharge(
  chargeId: string,
  supabase?: SupabaseClient<Database>,
): Promise<void> {
  const db = await resolveSupabase(supabase);
  const { data: existing, error: getErr } = await db
    .from("client_charges")
    .select(CHARGE_SELECT)
    .eq("id", chargeId)
    .maybeSingle();
  if (getErr) throw new Error(`deleteClientCharge: ${getErr.message}`);
  if (!existing) throw new Error("Cobrança não encontrada.");
  const mapped = mapCharge(existing as RawCharge);
  if (!canHardDeleteClientCharge(mapped)) {
    throw new Error(
      "Cobrança com pagamento registrado não pode ser apagada. Use cancelar.",
    );
  }
  const { error } = await db.from("client_charges").delete().eq("id", chargeId);
  if (error) throw new Error(`deleteClientCharge.delete: ${error.message}`);
}

export async function cancelClientCharge(
  chargeId: string,
  supabase?: SupabaseClient<Database>,
): Promise<ClientChargeRow> {
  const db = await resolveSupabase(supabase);
  const { data, error } = await db
    .from("client_charges")
    .update({ status: "cancelada" })
    .eq("id", chargeId)
    .select(CHARGE_SELECT)
    .single();
  if (error) throw new Error(`cancelClientCharge: ${error.message}`);
  return mapCharge(data as RawCharge);
}

export type UndoClientChargePaymentInput = {
  /** Omitir ou null = zera todo o recebimento. */
  newPaidAmount?: number | null;
};

export async function undoClientChargePayment(
  chargeId: string,
  input: UndoClientChargePaymentInput = {},
  supabase?: SupabaseClient<Database>,
): Promise<ClientChargeRow> {
  const db = await resolveSupabase(supabase);
  const { data: existing, error: getErr } = await db
    .from("client_charges")
    .select(CHARGE_SELECT)
    .eq("id", chargeId)
    .maybeSingle();
  if (getErr) throw new Error(`undoClientChargePayment: ${getErr.message}`);
  if (!existing) throw new Error("Cobrança não encontrada.");

  const mapped = mapCharge(existing as RawCharge);
  if (!canUndoClientChargePayment(mapped)) {
    throw new Error(
      mapped.externalProvider
        ? "Recebimento vinculado a gateway não pode ser desfeito aqui."
        : "Não há recebimento para desfazer.",
    );
  }

  const targetPaid =
    input.newPaidAmount === undefined ? 0 : (input.newPaidAmount ?? 0);
  const fullUndo = targetPaid <= 0;

  const patch = fullUndo
    ? {
        paid_amount: null,
        paid_at: null,
        payment_method: null,
        status: statusAfterUndoFullPayment(mapped.status),
      }
    : {
        paid_amount: targetPaid,
        status: statusAfterPartialPayment(targetPaid, mapped.netDue),
      };

  const { data, error } = await db
    .from("client_charges")
    .update(patch)
    .eq("id", chargeId)
    .select(CHARGE_SELECT)
    .single();
  if (error) throw new Error(`undoClientChargePayment.update: ${error.message}`);
  return mapCharge(data as RawCharge);
}
