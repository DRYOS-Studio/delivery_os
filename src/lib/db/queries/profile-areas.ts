import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type TaskArea = Database["public"]["Enums"]["task_area"];

export const ALL_AREAS: readonly TaskArea[] = ["cs", "financeiro", "juridico"];

export const AREA_LABELS: Record<TaskArea, string> = {
  cs: "CS",
  financeiro: "Financeiro",
  juridico: "Jurídico",
};

export type ProfileWithAreas = {
  id: string;
  name: string | null;
  areas: TaskArea[];
};

/**
 * Profiles `member` e suas áreas. Admin vê todas as áreas implicitamente
 * (can_see_area curto-circuita is_admin), então não entra aqui.
 */
export async function listProfilesWithAreas(): Promise<ProfileWithAreas[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
      id, name,
      areas:profile_areas!fk_profile_areas_profile_id (area)
      `,
    )
    .eq("role", "member")
    .order("name", { ascending: true });
  if (error) throw new Error(`listProfilesWithAreas: ${error.message}`);

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    areas: ((p.areas ?? []) as Array<{ area: TaskArea }>).map((a) => a.area),
  }));
}
