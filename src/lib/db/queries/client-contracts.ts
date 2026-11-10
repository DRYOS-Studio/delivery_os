import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type ClientContractStatus =
  Database["public"]["Enums"]["client_contract_status"];

export type ClientContractRow = {
  id: string;
  clientId: string;
  label: string;
  monthlyValue: number | null;
  implementationFee: number | null;
  implementationFeePaid: boolean;
  firstBillingDate: string | null;
  currency: string;
  reajusteNotes: string | null;
  startDate: string | null;
  endDate: string | null;
  paymentDayOfMonth: number | null;
  status: ClientContractStatus;
  notes: string | null;
  filename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  storagePath: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClientContractDetail = ClientContractRow;

const CONTRACT_SELECT =
  "id, client_id, label, monthly_value, implementation_fee, implementation_fee_paid, first_billing_date, currency, reajuste_notes, start_date, end_date, payment_day_of_month, status, notes, filename, mime_type, size_bytes, storage_path, created_at, updated_at";

type Raw = {
  id: string;
  client_id: string;
  label: string;
  monthly_value: number | null;
  implementation_fee: number | null;
  implementation_fee_paid: boolean;
  first_billing_date: string | null;
  currency: string;
  reajuste_notes: string | null;
  start_date: string | null;
  end_date: string | null;
  payment_day_of_month: number | null;
  status: ClientContractStatus;
  notes: string | null;
  filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(r: Raw): ClientContractRow {
  return {
    id: r.id,
    clientId: r.client_id,
    label: r.label,
    monthlyValue: r.monthly_value,
    implementationFee: r.implementation_fee,
    implementationFeePaid: r.implementation_fee_paid,
    firstBillingDate: r.first_billing_date,
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
    storagePath: r.storage_path,
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
    .select(CONTRACT_SELECT)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listClientContracts: ${error.message}`);
  return ((data ?? []) as Raw[]).map(mapRow);
}

export async function getClientContract(
  id: string,
): Promise<ClientContractDetail | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("client_contracts")
    .select(CONTRACT_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getClientContract: ${error.message}`);
  if (!data) return null;
  return mapRow(data as Raw);
}
