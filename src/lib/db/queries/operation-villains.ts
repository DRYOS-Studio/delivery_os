import { createAdmin, createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type OperationVillainRow =
  Database["public"]["Tables"]["operation_villains"]["Row"];

export type OperationVillainListItem = {
  id: string;
  operationId: string;
  villainId: string;
  initialSeverity: Database["public"]["Enums"]["severity_level"];
  progressPct: number;
  evidence: string | null;
  createdAt: string;
  villain: {
    id: string;
    name: string;
    slug: string;
    quote: string;
    description: string;
    iconName: string;
    pillVariant: string;
    archivedAt: string | null;
  };
};

const SELECT_FIELDS = `
  id, operation_id, villain_id, initial_severity, progress_pct, evidence, created_at,
  villain:villains!fk_operation_villains_villain_id (
    id, name, slug, quote, description, icon_name, pill_variant, archived_at
  )
`;

const SEVERITY_ORDER: Record<
  Database["public"]["Enums"]["severity_level"],
  number
> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function sortItems(
  a: OperationVillainListItem,
  b: OperationVillainListItem,
): number {
  // Progress DESC; severity DESC (critical first) como tie-breaker
  if (b.progressPct !== a.progressPct) return b.progressPct - a.progressPct;
  return SEVERITY_ORDER[a.initialSeverity] - SEVERITY_ORDER[b.initialSeverity];
}

type RawRow = {
  id: string;
  operation_id: string;
  villain_id: string;
  initial_severity: Database["public"]["Enums"]["severity_level"];
  progress_pct: number;
  evidence: string | null;
  created_at: string;
  villain: {
    id: string;
    name: string;
    slug: string;
    quote: string;
    description: string;
    icon_name: string;
    pill_variant: string;
    archived_at: string | null;
  } | null;
};

function mapRow(r: RawRow): OperationVillainListItem | null {
  if (!r.villain) return null;
  return {
    id: r.id,
    operationId: r.operation_id,
    villainId: r.villain_id,
    initialSeverity: r.initial_severity,
    progressPct: r.progress_pct,
    evidence: r.evidence,
    createdAt: r.created_at,
    villain: {
      id: r.villain.id,
      name: r.villain.name,
      slug: r.villain.slug,
      quote: r.villain.quote,
      description: r.villain.description,
      iconName: r.villain.icon_name,
      pillVariant: r.villain.pill_variant,
      archivedAt: r.villain.archived_at,
    },
  };
}

export async function listVillainsByOperation(
  operationId: string,
): Promise<OperationVillainListItem[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("operation_villains")
    .select(SELECT_FIELDS)
    .eq("operation_id", operationId);
  if (error) throw new Error(`listVillainsByOperation: ${error.message}`);
  if (!data) return [];
  return data
    .map((r) => mapRow(r as RawRow))
    .filter((r): r is OperationVillainListItem => r !== null)
    .sort(sortItems);
}

export async function getOperationVillain(
  id: string,
): Promise<OperationVillainRow | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("operation_villains")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getOperationVillain: ${error.message}`);
  return data;
}

// Public: bypass RLS via admin; mesma shape
export async function listPublicVillains(
  operationId: string,
): Promise<OperationVillainListItem[]> {
  const admin = createAdmin();
  const { data, error } = await admin
    .from("operation_villains")
    .select(SELECT_FIELDS)
    .eq("operation_id", operationId);
  if (error) throw new Error(`listPublicVillains: ${error.message}`);
  if (!data) return [];
  return data
    .map((r) => mapRow(r as RawRow))
    .filter((r): r is OperationVillainListItem => r !== null)
    .sort(sortItems);
}

export type AvailableVillain = {
  id: string;
  name: string;
  slug: string;
  iconName: string;
};

export async function listAvailableVillains(
  operationId: string,
): Promise<AvailableVillain[]> {
  const supabase = await createServer();
  const { data: assigned, error: aErr } = await supabase
    .from("operation_villains")
    .select("villain_id")
    .eq("operation_id", operationId);
  if (aErr) throw new Error(`listAvailableVillains.assigned: ${aErr.message}`);
  const assignedIds = (assigned ?? []).map((r) => r.villain_id);

  let query = supabase
    .from("villains")
    .select("id, name, slug, icon_name")
    .is("archived_at", null)
    .order("display_order", { ascending: true });
  if (assignedIds.length > 0) {
    query = query.not("id", "in", `(${assignedIds.join(",")})`);
  }
  const { data, error } = await query;
  if (error) throw new Error(`listAvailableVillains: ${error.message}`);
  if (!data) return [];
  return data.map((v) => ({
    id: v.id,
    name: v.name,
    slug: v.slug,
    iconName: v.icon_name,
  }));
}
