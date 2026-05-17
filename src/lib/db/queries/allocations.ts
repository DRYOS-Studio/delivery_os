import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type AllocationRow = Database["public"]["Tables"]["allocations"]["Row"];

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
): Promise<AllocationRow | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("allocations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getAllocation: ${error.message}`);
  return data;
}
