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

/**
 * Pode criar tarefa de área nesta operação = admin OU é de uma área (não-arquivada)
 * com concessão da operação. Espelha o WITH CHECK de INSERT de tarefa de área.
 */
export async function canCreateAreaTaskInOperation(
  operationId: string,
): Promise<boolean> {
  const supabase = await createServer();
  const { data, error } = await supabase.rpc("is_area_granted", {
    p_op_id: operationId,
  });
  if (error) throw new Error(`canCreateAreaTaskInOperation: ${error.message}`);
  return data === true;
}

/**
 * Áreas em que o usuário pode CRIAR tarefa de área nesta operação.
 * Admin → todas as ativas. Membro de área → só as suas (profile_areas, RLS-scoped)
 * que alcançam a operação (area_can_reach_operation). Lista vazia = não pode criar.
 */
export async function listCreatableAreasForOperation(
  operationId: string,
  isAdmin: boolean,
): Promise<Array<{ id: string; name: string }>> {
  if (isAdmin) return listAreaOptions();

  const supabase = await createServer();
  // RLS (pa_member_select_self) restringe a profile_areas do próprio usuário.
  const { data, error } = await supabase
    .from("profile_areas")
    .select("area:areas!fk_profile_areas_area_id ( id, name, archived_at )");
  if (error) throw new Error(`listCreatableAreasForOperation: ${error.message}`);

  type Row = {
    area:
      | { id: string; name: string; archived_at: string | null }
      | { id: string; name: string; archived_at: string | null }[]
      | null;
  };
  const myAreas = ((data ?? []) as Row[])
    .map((r) => (Array.isArray(r.area) ? (r.area[0] ?? null) : r.area))
    .filter((a): a is { id: string; name: string; archived_at: string | null } =>
      a != null && a.archived_at === null,
    );

  const reachable = await Promise.all(
    myAreas.map(async (a) => {
      const { data: ok } = await supabase.rpc("area_can_reach_operation", {
        p_area_id: a.id,
        p_op_id: operationId,
      });
      return ok === true ? { id: a.id, name: a.name } : null;
    }),
  );
  return reachable.filter((a): a is { id: string; name: string } => a != null);
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
