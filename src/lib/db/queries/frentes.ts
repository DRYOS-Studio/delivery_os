import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type FrenteRow = Database["public"]["Tables"]["frentes"]["Row"];

export async function getFrente(id: string): Promise<FrenteRow | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("frentes")
    .select("*")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error(`getFrente: ${error.message}`);
  return data;
}


export type FrenteAttentionItem = {
  id: string;
  name: string;
  cycleType: Database["public"]["Enums"]["frente_cycle_type"];
  actionableStatus: string;
  actionableStatusSince: string;
  operation: { id: string; name: string };
  client: { name: string };
  responsible: { id: string; name: string } | null;
};

export async function listFrentesNeedingAttention(
  limit = 8,
): Promise<FrenteAttentionItem[]> {
  const supabase = await createServer();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("frentes")
    .select(
      `
      id, name, cycle_type, actionable_status, actionable_status_since,
      operation:operations!fk_frentes_operation_id (
        id, name,
        client:clients!fk_operations_client_id (name)
      ),
      responsible:persons!fk_frentes_responsible_person_id (id, name)
      `,
    )
    .is("archived_at", null)
    .lt("actionable_status_since", sevenDaysAgo)
    .order("actionable_status_since", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`listFrentesNeedingAttention: ${error.message}`);
  if (!data) return [];

  return data.map((f): FrenteAttentionItem => ({
    id: f.id,
    name: f.name,
    cycleType: f.cycle_type,
    actionableStatus: f.actionable_status,
    actionableStatusSince: f.actionable_status_since,
    operation: {
      id: f.operation?.id ?? "",
      name: f.operation?.name ?? "—",
    },
    client: {
      name: f.operation?.client?.name ?? "—",
    },
    responsible: f.responsible
      ? { id: f.responsible.id, name: f.responsible.name }
      : null,
  }));
}

export type FrenteDetail = {
  id: string;
  operationId: string;
  name: string;
  cycleType: Database["public"]["Enums"]["frente_cycle_type"];
  domain: Database["public"]["Enums"]["frente_domain"];
  phase: Database["public"]["Enums"]["frente_phase"];
  actionableStatus: string;
  actionableStatusSince: string;
  startDate: string | null;
  endDate: string | null;
  responsiblePersonId: string | null;
  responsibleName: string | null;
};

export async function getFrenteDetail(
  id: string,
): Promise<FrenteDetail | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("frentes")
    .select(
      `
      id, operation_id, name, cycle_type, domain, phase,
      actionable_status, actionable_status_since,
      start_date, end_date, responsible_person_id,
      responsible:persons!fk_frentes_responsible_person_id(name)
      `,
    )
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error(`getFrenteDetail: ${error.message}`);
  if (!data) return null;
  const resp = Array.isArray(data.responsible)
    ? (data.responsible[0] ?? null)
    : data.responsible;
  return {
    id: data.id,
    operationId: data.operation_id,
    name: data.name,
    cycleType: data.cycle_type,
    domain: data.domain,
    phase: data.phase,
    actionableStatus: data.actionable_status,
    actionableStatusSince: data.actionable_status_since,
    startDate: data.start_date,
    endDate: data.end_date,
    responsiblePersonId: data.responsible_person_id,
    responsibleName: resp?.name ?? null,
  };
}

export async function countHotCriticalFrentes(): Promise<number> {
  const supabase = await createServer();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const { count, error } = await supabase
    .from("frentes")
    .select("id", { count: "exact", head: true })
    .is("archived_at", null)
    .lt("actionable_status_since", fourteenDaysAgo);
  if (error) throw new Error(`countHotCriticalFrentes: ${error.message}`);
  return count ?? 0;
}
