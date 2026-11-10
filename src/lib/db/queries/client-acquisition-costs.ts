import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";
import type { ClientAcquisitionCostCategory } from "@/lib/utils/client-cac-category";
import type { SupabaseClient } from "@supabase/supabase-js";

async function resolveSupabase(
  supabase?: SupabaseClient<Database>,
): Promise<SupabaseClient<Database>> {
  return supabase ?? (await createServer());
}

export type ClientAcquisitionCostRow = {
  id: string;
  clientId: string;
  spentOn: string;
  description: string;
  category: ClientAcquisitionCostCategory;
  amount: number;
  createdAt: string;
  updatedAt: string;
};

type Raw = {
  id: string;
  client_id: string;
  spent_on: string;
  description: string;
  category: ClientAcquisitionCostCategory;
  amount: number | string;
  created_at: string;
  updated_at: string;
};

function mapRow(r: Raw): ClientAcquisitionCostRow {
  return {
    id: r.id,
    clientId: r.client_id,
    spentOn: r.spent_on,
    description: r.description,
    category: r.category,
    amount: Number(r.amount),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const SELECT =
  "id, client_id, spent_on, description, category, amount, created_at, updated_at";

export async function listClientAcquisitionCosts(
  clientId: string,
  supabase?: SupabaseClient<Database>,
): Promise<ClientAcquisitionCostRow[]> {
  const db = await resolveSupabase(supabase);
  const { data, error } = await db
    .from("client_acquisition_costs")
    .select(SELECT)
    .eq("client_id", clientId)
    .order("spent_on", { ascending: false });
  if (error) throw new Error(`listClientAcquisitionCosts: ${error.message}`);
  return (data ?? []).map((r) => mapRow(r as Raw));
}

export async function getClientAcquisitionCost(
  id: string,
  supabase?: SupabaseClient<Database>,
): Promise<ClientAcquisitionCostRow | null> {
  const db = await resolveSupabase(supabase);
  const { data, error } = await db
    .from("client_acquisition_costs")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getClientAcquisitionCost: ${error.message}`);
  if (!data) return null;
  return mapRow(data as Raw);
}

export async function sumClientAcquisitionCosts(
  clientId: string,
  supabase?: SupabaseClient<Database>,
): Promise<number> {
  const db = await resolveSupabase(supabase);
  const { data, error } = await db
    .from("client_acquisition_costs")
    .select("amount")
    .eq("client_id", clientId);
  if (error) throw new Error(`sumClientAcquisitionCosts: ${error.message}`);
  return (data ?? []).reduce((s, row) => s + Number(row.amount), 0);
}

export type ClientAcquisitionCostInsert =
  Database["public"]["Tables"]["client_acquisition_costs"]["Insert"];
