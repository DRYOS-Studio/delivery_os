import { createServer } from "@/lib/db/client";
import { listClientChargesForLtvByClients } from "@/lib/db/queries/client-charges";
import { sumClientAcquisitionCosts } from "@/lib/db/queries/client-acquisition-costs";
import { getOperationsMonthlyCostsBatch } from "@/lib/db/queries/operation-costs";
import {
  computeClientLtvFromCharges,
  computeLtvCacRatio,
} from "@/lib/utils/client-charge-ltv";
import { ACTIVE_STATUSES } from "@/lib/utils/operation-status";
import {
  contractMrrMismatch,
  earliestIsoDate,
  sumVigenteContractMonthly,
} from "@/lib/utils/client-financial-helpers";
import { computeMargin, type MarginResult } from "@/lib/utils/margin";
import type { Database } from "@/lib/db/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ClientFinancialSummary = {
  clientId: string;
  activeOperationsCount: number;
  mrrTotal: number;
  monthlyCostTotal: number;
  margin: MarginResult;
  cacTotal: number;
  tenureStartDate: string | null;
  contractMonthlyTotal: number | null;
  contractMrrMismatch: boolean;
  contractMrrDelta: number | null;
  ltvReceived: number;
  receivablePending: number;
  ltvCacRatio: number | null;
};

type ActiveOpRow = {
  id: string;
  client_id: string;
  monthly_recurring_revenue: number | null;
  start_date: string | null;
};

async function loadActiveOpsForClients(
  clientIds: string[],
  supabase: SupabaseClient<Database>,
): Promise<ActiveOpRow[]> {
  if (clientIds.length === 0) return [];
  const { data, error } = await supabase
    .from("operations")
    .select("id, client_id, monthly_recurring_revenue, start_date")
    .in("client_id", clientIds)
    .is("archived_at", null)
    .in("status", ACTIVE_STATUSES);
  if (error) {
    throw new Error(`loadActiveOpsForClients: ${error.message}`);
  }
  return data ?? [];
}

async function sumCacByClients(
  clientIds: string[],
  supabase: SupabaseClient<Database>,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (clientIds.length === 0) return out;
  const { data, error } = await supabase
    .from("client_acquisition_costs")
    .select("client_id, amount")
    .in("client_id", clientIds);
  if (error) throw new Error(`sumCacByClients: ${error.message}`);
  for (const row of data ?? []) {
    const amt = Number(row.amount);
    out.set(row.client_id, (out.get(row.client_id) ?? 0) + amt);
  }
  return out;
}

type ContractRow = {
  client_id: string;
  status: string;
  monthly_value: number | null;
  start_date: string | null;
};

async function loadContractsForClients(
  clientIds: string[],
  supabase: SupabaseClient<Database>,
): Promise<ContractRow[]> {
  if (clientIds.length === 0) return [];
  const { data, error } = await supabase
    .from("client_contracts")
    .select("client_id, status, monthly_value, start_date")
    .in("client_id", clientIds);
  if (error) throw new Error(`loadContractsForClients: ${error.message}`);
  return data ?? [];
}

function buildSummaryForClient(
  clientId: string,
  ops: ActiveOpRow[],
  breakdownCostByOp: Map<string, number>,
  cacTotal: number,
  contracts: ContractRow[],
  ltvReceived: number,
  receivablePending: number,
): ClientFinancialSummary {
  const mrrTotal = ops.reduce(
    (s, o) => s + (o.monthly_recurring_revenue ?? 0),
    0,
  );
  const monthlyCostTotal = ops.reduce(
    (s, o) => s + (breakdownCostByOp.get(o.id) ?? 0),
    0,
  );
  const margin = computeMargin(mrrTotal, monthlyCostTotal);
  const clientContracts = contracts.filter((c) => c.client_id === clientId);
  const contractMonthlyTotal = sumVigenteContractMonthly(
    clientContracts.map((c) => ({
      status: c.status,
      monthlyValue: c.monthly_value,
    })),
  );
  const mismatch = contractMrrMismatch(mrrTotal, contractMonthlyTotal);
  const tenureStartDate = earliestIsoDate([
    ...ops.map((o) => o.start_date),
    ...clientContracts.map((c) => c.start_date),
  ]);
  return {
    clientId,
    activeOperationsCount: ops.length,
    mrrTotal,
    monthlyCostTotal,
    margin,
    cacTotal,
    tenureStartDate,
    contractMonthlyTotal,
    contractMrrMismatch: mismatch,
    contractMrrDelta:
      contractMonthlyTotal !== null ? contractMonthlyTotal - mrrTotal : null,
    ltvReceived,
    receivablePending,
    ltvCacRatio: computeLtvCacRatio(ltvReceived, cacTotal),
  };
}

export async function getClientFinancialSummariesForClients(
  clientIds: string[],
  options: { includeCac?: boolean } = {},
  supabaseClient?: SupabaseClient<Database>,
): Promise<Map<string, ClientFinancialSummary>> {
  const uniqueIds = [...new Set(clientIds)];
  const supabase = supabaseClient ?? (await createServer());
  const includeCac = options.includeCac ?? true;

  const [ops, contracts, chargesByClient] = await Promise.all([
    loadActiveOpsForClients(uniqueIds, supabase),
    loadContractsForClients(uniqueIds, supabase),
    listClientChargesForLtvByClients(uniqueIds, supabase),
  ]);
  const opIds = ops.map((o) => o.id);
  const [breakdowns, cacByClient] = await Promise.all([
    getOperationsMonthlyCostsBatch(opIds, supabase),
    includeCac ? sumCacByClients(uniqueIds, supabase) : Promise.resolve(new Map()),
  ]);

  const costByOp = new Map<string, number>();
  for (const [opId, b] of breakdowns) {
    costByOp.set(opId, b.totalMonthly);
  }

  const opsByClient = new Map<string, ActiveOpRow[]>();
  for (const op of ops) {
    const list = opsByClient.get(op.client_id) ?? [];
    list.push(op);
    opsByClient.set(op.client_id, list);
  }

  const out = new Map<string, ClientFinancialSummary>();
  for (const clientId of uniqueIds) {
    const clientOps = opsByClient.get(clientId) ?? [];
    const ltvTotals = computeClientLtvFromCharges(
      chargesByClient.get(clientId) ?? [],
    );
    out.set(
      clientId,
      buildSummaryForClient(
        clientId,
        clientOps,
        costByOp,
        cacByClient.get(clientId) ?? 0,
        contracts,
        ltvTotals.ltvReceived,
        ltvTotals.receivablePending,
      ),
    );
  }
  return out;
}

export async function getClientFinancialSummary(
  clientId: string,
  options: { includeCac?: boolean } = {},
  supabaseClient?: SupabaseClient<Database>,
): Promise<ClientFinancialSummary> {
  const map = await getClientFinancialSummariesForClients(
    [clientId],
    options,
    supabaseClient,
  );
  const summary = map.get(clientId);
  if (!summary) {
    return buildSummaryForClient(clientId, [], new Map(), 0, [], 0, 0);
  }
  return summary;
}
