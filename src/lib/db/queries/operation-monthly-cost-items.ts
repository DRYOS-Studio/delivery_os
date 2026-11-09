import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";
import {
  categorySubtotals,
  sumMonthlyCostItems,
  type OperationMonthlyCostCategory,
} from "@/lib/utils/operation-monthly-cost-category";
import type { SupabaseClient } from "@supabase/supabase-js";

export type OperationMonthlyCostItemRow = {
  id: string;
  operationId: string;
  category: OperationMonthlyCostCategory;
  amount: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

type RawRow = {
  id: string;
  operation_id: string;
  category: OperationMonthlyCostCategory;
  amount: number | string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(r: RawRow): OperationMonthlyCostItemRow {
  return {
    id: r.id,
    operationId: r.operation_id,
    category: r.category,
    amount: Number(r.amount),
    description: r.description,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listOperationMonthlyCostItems(
  operationId: string,
  supabaseClient?: SupabaseClient<Database>,
): Promise<OperationMonthlyCostItemRow[]> {
  const supabase = supabaseClient ?? (await createServer());
  const { data, error } = await supabase
    .from("operation_monthly_cost_items")
    .select("*")
    .eq("operation_id", operationId)
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(`listOperationMonthlyCostItems: ${error.message}`);
  }
  return (data ?? []).map((r) => mapRow(r as RawRow));
}

export type MonthlyCostItemsSummary = {
  items: OperationMonthlyCostItemRow[];
  categorySubtotals: Partial<Record<OperationMonthlyCostCategory, number>>;
  totalMonthly: number;
};

export function summarizeMonthlyCostItems(
  items: OperationMonthlyCostItemRow[],
): MonthlyCostItemsSummary {
  return {
    items,
    categorySubtotals: categorySubtotals(items),
    totalMonthly: sumMonthlyCostItems(items),
  };
}

export async function getOperationMonthlyCostItemsSummary(
  operationId: string,
  supabaseClient?: SupabaseClient<Database>,
): Promise<MonthlyCostItemsSummary> {
  const items = await listOperationMonthlyCostItems(
    operationId,
    supabaseClient,
  );
  return summarizeMonthlyCostItems(items);
}

/** Soma por operação (várias ops) para agregados do dashboard. */
export async function sumMonthlyCostItemsByOperations(
  operationIds: string[],
  supabaseClient?: SupabaseClient<Database>,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (operationIds.length === 0) return out;
  const supabase = supabaseClient ?? (await createServer());
  const { data, error } = await supabase
    .from("operation_monthly_cost_items")
    .select("operation_id, amount")
    .in("operation_id", operationIds);
  if (error) {
    throw new Error(`sumMonthlyCostItemsByOperations: ${error.message}`);
  }
  for (const r of data ?? []) {
    const id = r.operation_id;
    const prev = out.get(id) ?? 0;
    out.set(id, prev + Number(r.amount));
  }
  return out;
}
