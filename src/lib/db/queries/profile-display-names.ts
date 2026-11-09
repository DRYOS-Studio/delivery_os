import { createServer } from "@/lib/db/client";

/** Nomes exibíveis via view profile_display_names (SECURITY DEFINER + RLS em profiles). */
export async function resolveProfileDisplayNames(
  profileIds: ReadonlyArray<string>,
): Promise<Map<string, string>> {
  const unique = [...new Set(profileIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const supabase = await createServer();
  const { data, error } = await supabase
    .from("profile_display_names")
    .select("profile_id, display_name")
    .in("profile_id", unique);

  if (error) {
    console.error("resolveProfileDisplayNames", error.message);
    return map;
  }

  for (const row of data ?? []) {
    const label = row.display_name?.trim();
    if (label) map.set(row.profile_id, label);
  }
  return map;
}

export function pickProfileDisplayName(
  map: ReadonlyMap<string, string>,
  profileId: string,
): string | null {
  return map.get(profileId)?.trim() ?? null;
}
