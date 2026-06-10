import { createServer } from "@/lib/db/client";

export type Area = {
  id: string;
  slug: string;
  name: string;
  archivedAt: string | null;
};

function mapArea(a: {
  id: string;
  slug: string;
  name: string;
  archived_at: string | null;
}): Area {
  return { id: a.id, slug: a.slug, name: a.name, archivedAt: a.archived_at };
}

/** Áreas não-arquivadas (catálogo dinâmico). RLS deixa todo autenticado ler. */
export async function listAreas(): Promise<Area[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("areas")
    .select("id, slug, name, archived_at")
    .is("archived_at", null)
    .order("name", { ascending: true });
  if (error) throw new Error(`listAreas: ${error.message}`);
  return (data ?? []).map(mapArea);
}

/** Uma área por id (null se não existe). */
export async function getArea(id: string): Promise<Area | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("areas")
    .select("id, slug, name, archived_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getArea: ${error.message}`);
  return data ? mapArea(data) : null;
}

/** id+name das áreas ativas (pra selects/atribuição). */
export async function listAreaOptions(): Promise<
  Array<{ id: string; name: string }>
> {
  return (await listAreas()).map((a) => ({ id: a.id, name: a.name }));
}

export type AreaAdminItem = {
  id: string;
  name: string;
  archivedAt: string | null;
  memberCount: number;
};

/** Áreas (todas) + contagem de membros — pra tela admin. */
export async function listAreasForAdmin(): Promise<AreaAdminItem[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("areas")
    .select(
      "id, name, archived_at, members:profile_areas!fk_profile_areas_area_id(count)",
    )
    .order("archived_at", { ascending: true, nullsFirst: true })
    .order("name", { ascending: true });
  if (error) throw new Error(`listAreasForAdmin: ${error.message}`);
  type Row = {
    id: string;
    name: string;
    archived_at: string | null;
    members: { count: number }[] | null;
  };
  return ((data ?? []) as Row[]).map((a) => ({
    id: a.id,
    name: a.name,
    archivedAt: a.archived_at,
    memberCount: a.members?.[0]?.count ?? 0,
  }));
}
