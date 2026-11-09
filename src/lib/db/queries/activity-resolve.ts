import { createServer } from "@/lib/db/client";
import type { ActivityEventRow } from "@/lib/db/queries/activity";
import { resolveProfileDisplayNames } from "@/lib/db/queries/profile-display-names";
export type ActivityResolveMaps = {
  persons: Map<string, string>;
  frentes: Map<string, string>;
  operations: Map<string, string>;
  clients: Map<string, string>;
  areas: Map<string, string>;
  profileNames: Map<string, string>;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function collectUuids(events: ActivityEventRow[]): Set<string> {
  const ids = new Set<string>();

  const add = (raw: unknown): void => {
    if (typeof raw === "string" && UUID_RE.test(raw)) ids.add(raw);
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const o = raw as Record<string, unknown>;
      for (const v of Object.values(o)) {
        if (typeof v === "string" && UUID_RE.test(v)) ids.add(v);
      }
    }
  };

  for (const e of events) {
    if (e.actorProfileId) ids.add(e.actorProfileId);
    add(e.oldValue);
    add(e.newValue);
  }
  return ids;
}

function pickNames(
  rows: { id: string; name: string | null }[] | null,
): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of rows ?? []) {
    if (r.name?.trim()) m.set(r.id, r.name.trim());
  }
  return m;
}

/** Carrega nomes referenciados nos eventos (RLS aplicado). */
export async function buildActivityFormatContext(
  events: ActivityEventRow[],
): Promise<ActivityResolveMaps> {
  const ids = collectUuids(events);
  const idList = [...ids];

  const persons = new Map<string, string>();
  const frentes = new Map<string, string>();
  const operations = new Map<string, string>();
  const clients = new Map<string, string>();
  const areas = new Map<string, string>();
  const profileNames = new Map<string, string>();

  if (idList.length === 0) {
    return { persons, frentes, operations, clients, areas, profileNames };
  }

  const supabase = await createServer();

  const profileIds = [
    ...new Set(
      events
        .map((e) => e.actorProfileId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [personRes, frenteRes, opRes, clientRes, areaRes, profileNameMap] =
    await Promise.all([
      supabase.from("persons").select("id, name").in("id", idList),
      supabase.from("frentes").select("id, name").in("id", idList),
      supabase.from("operations").select("id, name").in("id", idList),
      supabase.from("clients").select("id, name").in("id", idList),
      supabase.from("areas").select("id, name").in("id", idList),
      resolveProfileDisplayNames(profileIds),
    ]);

  for (const [k, v] of pickNames(personRes.data)) persons.set(k, v);
  for (const [k, v] of pickNames(frenteRes.data)) frentes.set(k, v);
  for (const [k, v] of pickNames(opRes.data)) operations.set(k, v);
  for (const [k, v] of pickNames(clientRes.data)) clients.set(k, v);
  for (const [k, v] of pickNames(areaRes.data)) areas.set(k, v);
  for (const [k, v] of profileNameMap) profileNames.set(k, v);

  return { persons, frentes, operations, clients, areas, profileNames };
}
