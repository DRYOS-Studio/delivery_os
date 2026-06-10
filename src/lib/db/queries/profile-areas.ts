import { createServer } from "@/lib/db/client";
import type { AreaOption } from "@/lib/utils/areas";

export type ProfileWithAreas = {
  id: string;
  name: string | null;
  areas: AreaOption[];
};

/**
 * Profiles `member` e suas áreas (id+name). Admin enxerga todas as áreas
 * implicitamente (user_in_area curto-circuita is_admin), então não entra aqui.
 */
export async function listProfilesWithAreas(): Promise<ProfileWithAreas[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
      id, name,
      areas:profile_areas!fk_profile_areas_profile_id (
        area:areas!fk_profile_areas_area_id ( id, name )
      )
      `,
    )
    .eq("role", "member")
    .order("name", { ascending: true });
  if (error) throw new Error(`listProfilesWithAreas: ${error.message}`);

  type Row = {
    id: string;
    name: string | null;
    areas:
      | Array<{ area: AreaOption | AreaOption[] | null }>
      | null;
  };

  return ((data ?? []) as Row[]).map((p) => ({
    id: p.id,
    name: p.name,
    areas: (p.areas ?? [])
      .map((r) => (Array.isArray(r.area) ? (r.area[0] ?? null) : r.area))
      .filter((a): a is AreaOption => a != null),
  }));
}
