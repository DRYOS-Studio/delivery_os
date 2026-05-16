import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type PersonDetail = Database["public"]["Tables"]["persons"]["Row"];

export type PersonKindFilter = "internal" | "external" | undefined;

export type PersonListItem = {
  id: string;
  name: string;
  kind: "internal" | "external";
  specialty: string | null;
  externalRole: string | null;
  email: string | null;
  clientId: string | null;
  clientName: string | null;
};

export type PersonAllocationItem = {
  allocationId: string;
  role: "responsavel" | "executor" | "aprovador" | "plantao";
  capacityWeeklyPct: number;
  frente: {
    id: string;
    name: string;
    cycleType: "a" | "b" | "c" | "d" | "e";
  };
  operation: {
    id: string;
    name: string;
    clientName: string;
  };
};

export type ExternalPersonItem = {
  id: string;
  name: string;
  email: string | null;
  externalRole: string;
};

export type InternalPersonItem = {
  id: string;
  name: string;
};

export async function listPersons(
  options: { kind?: PersonKindFilter; search?: string | undefined } = {},
): Promise<PersonListItem[]> {
  const supabase = await createServer();
  let query = supabase
    .from("persons")
    .select(
      `
      id, name, kind, specialty, external_role, email, client_id,
      client:clients(name)
      `,
    )
    .is("archived_at", null)
    .order("name", { ascending: true });

  if (options.kind) {
    query = query.eq("kind", options.kind);
  }
  const search = options.search?.trim();
  if (search) {
    const escaped = search.replace(/[%_]/g, (m) => `\\${m}`);
    query = query.or(`name.ilike.%${escaped}%,email.ilike.%${escaped}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`listPersons: ${error.message}`);
  return (data ?? []).map((p): PersonListItem => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    specialty: p.specialty,
    externalRole: p.external_role,
    email: p.email,
    clientId: p.client_id,
    clientName: p.client?.name ?? null,
  }));
}

export async function getPerson(id: string): Promise<PersonDetail | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("persons")
    .select("*")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error(`getPerson: ${error.message}`);
  return data;
}

export async function countActivePersons(): Promise<{
  internal: number;
  external: number;
  total: number;
}> {
  const supabase = await createServer();
  const [intRes, extRes] = await Promise.all([
    supabase
      .from("persons")
      .select("id", { count: "exact", head: true })
      .eq("kind", "internal")
      .is("archived_at", null),
    supabase
      .from("persons")
      .select("id", { count: "exact", head: true })
      .eq("kind", "external")
      .is("archived_at", null),
  ]);
  if (intRes.error)
    throw new Error(`countActivePersons(int): ${intRes.error.message}`);
  if (extRes.error)
    throw new Error(`countActivePersons(ext): ${extRes.error.message}`);
  const internal = intRes.count ?? 0;
  const external = extRes.count ?? 0;
  return { internal, external, total: internal + external };
}

export async function personHasActiveAllocations(
  personId: string,
): Promise<boolean> {
  const supabase = await createServer();
  const { count, error } = await supabase
    .from("allocations")
    .select("id", { count: "exact", head: true })
    .eq("person_id", personId);
  if (error)
    throw new Error(`personHasActiveAllocations: ${error.message}`);
  return (count ?? 0) > 0;
}

export async function getPersonAllocations(
  personId: string,
): Promise<PersonAllocationItem[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("allocations")
    .select(
      `
      id, role, capacity_weekly_pct,
      frente:frentes!fk_allocations_frente_id(
        id, name, cycle_type, archived_at,
        operation:operations!fk_frentes_operation_id(
          id, name, archived_at, status,
          client:clients(name)
        )
      )
      `,
    )
    .eq("person_id", personId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`getPersonAllocations: ${error.message}`);
  if (!data) return [];

  return data
    .filter(
      (a) =>
        a.frente &&
        a.frente.archived_at === null &&
        a.frente.operation &&
        a.frente.operation.archived_at === null,
    )
    .map((a): PersonAllocationItem => ({
      allocationId: a.id,
      role: a.role,
      capacityWeeklyPct: Number(a.capacity_weekly_pct),
      frente: {
        id: a.frente!.id,
        name: a.frente!.name,
        cycleType: a.frente!.cycle_type,
      },
      operation: {
        id: a.frente!.operation!.id,
        name: a.frente!.operation!.name,
        clientName: a.frente!.operation!.client?.name ?? "—",
      },
    }));
}

export async function listInternalPersons(): Promise<InternalPersonItem[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("persons")
    .select("id, name")
    .eq("kind", "internal")
    .is("archived_at", null)
    .order("name", { ascending: true });
  if (error) throw new Error(`listInternalPersons: ${error.message}`);
  return data ?? [];
}

export async function getExternalPersonsByClient(
  clientId: string,
): Promise<ExternalPersonItem[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("persons")
    .select("id, name, email, external_role")
    .eq("client_id", clientId)
    .eq("kind", "external")
    .is("archived_at", null)
    .order("name", { ascending: true });
  if (error) throw new Error(`getExternalPersonsByClient: ${error.message}`);
  if (!data) return [];
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    externalRole: p.external_role ?? "",
  }));
}
