import { getProfile } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { normalizeEmbedOne } from "@/lib/db/normalize-embed";
import type { Database } from "@/lib/db/types";

export type AllocationRow = Database["public"]["Tables"]["allocations"]["Row"];

export type AllocationWithMetrics = AllocationRow & {
  weekly_hours: number | null;
  monthly_cost: number | null;
};

export type AllocationListItem = {
  id: string;
  role: "responsavel" | "executor" | "aprovador" | "plantao";
  capacityWeeklyPct: number;
  startDate: string;
  endDate: string | null;
  person: { id: string; name: string };
};

const ROLE_ORDER: Record<AllocationListItem["role"], number> = {
  responsavel: 0,
  aprovador: 1,
  executor: 2,
  plantao: 3,
};

export async function listAllocationsByFrente(
  frenteId: string,
): Promise<AllocationListItem[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("allocations")
    .select(
      `
      id, role, capacity_weekly_pct, start_date, end_date,
      person:persons!fk_allocations_person_id(id, name, archived_at)
      `,
    )
    .eq("frente_id", frenteId);

  if (error) throw new Error(`listAllocationsByFrente: ${error.message}`);
  if (!data) return [];

  return data
    .filter((a) => a.person && a.person.archived_at === null)
    .map((a): AllocationListItem => ({
      id: a.id,
      role: a.role,
      capacityWeeklyPct: Number(a.capacity_weekly_pct),
      startDate: a.start_date,
      endDate: a.end_date,
      person: {
        id: a.person!.id,
        name: a.person!.name,
      },
    }))
    .sort((a, b) => {
      const r = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
      if (r !== 0) return r;
      return a.person.name.localeCompare(b.person.name);
    });
}

export async function getAllocation(
  id: string,
): Promise<AllocationWithMetrics | null> {
  const supabase = await createServer();
  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";
  const { data, error } = await (isAdmin
    ? supabase
        .from("allocations")
        .select(
          "*, metrics:allocation_cost_metrics(weekly_hours, monthly_cost)",
        )
    : supabase.from("allocations").select("*")
  )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getAllocation: ${error.message}`);
  if (!data) return null;
  const metrics = isAdmin
    ? normalizeEmbedOne(
        (
          data as AllocationRow & {
            metrics:
              | { weekly_hours: number | null; monthly_cost: number | null }
              | { weekly_hours: number | null; monthly_cost: number | null }[]
              | null;
          }
        ).metrics,
      )
    : null;
  const { metrics: _m, ...base } = data as AllocationRow & {
    metrics?: unknown;
  };
  return {
    ...base,
    weekly_hours:
      metrics?.weekly_hours === null || metrics?.weekly_hours === undefined
        ? null
        : Number(metrics.weekly_hours),
    monthly_cost:
      metrics?.monthly_cost === null || metrics?.monthly_cost === undefined
        ? null
        : Number(metrics.monthly_cost),
  };
}
