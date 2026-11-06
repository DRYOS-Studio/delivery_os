import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type ClientContractStatus =
  Database["public"]["Enums"]["client_contract_status"];

export type ClientContractRow = {
  id: string;
  clientId: string;
  label: string;
  monthlyValue: number | null;
  currency: string;
  reajusteNotes: string | null;
  startDate: string | null;
  endDate: string | null;
  paymentDayOfMonth: number | null;
  status: ClientContractStatus;
  notes: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
};

type Raw = {
  id: string;
  client_id: string;
  label: string;
  monthly_value: number | null;
  currency: string;
  reajuste_notes: string | null;
  start_date: string | null;
  end_date: string | null;
  payment_day_of_month: number | null;
  status: ClientContractStatus;
  notes: string | null;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
};

function mapRow(r: Raw): ClientContractRow {
  return {
    id: r.id,
    clientId: r.client_id,
    label: r.label,
    monthlyValue: r.monthly_value,
    currency: r.currency,
    reajusteNotes: r.reajuste_notes,
    startDate: r.start_date,
    endDate: r.end_date,
    paymentDayOfMonth: r.payment_day_of_month,
    status: r.status,
    notes: r.notes,
    filename: r.filename,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listClientContracts(
  clientId: string,
): Promise<ClientContractRow[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("client_contracts")
    .select(
      "id, client_id, label, monthly_value, currency, reajuste_notes, start_date, end_date, payment_day_of_month, status, notes, filename, mime_type, size_bytes, created_at, updated_at",
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listClientContracts: ${error.message}`);
  return ((data ?? []) as Raw[]).map(mapRow);
}
