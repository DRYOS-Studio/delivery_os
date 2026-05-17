import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type VillainRow = Database["public"]["Tables"]["villains"]["Row"];

export type VillainListItem = {
  id: string;
  name: string;
  slug: string;
  quote: string;
  description: string;
  iconName: string;
  pillVariant: string;
  displayOrder: number;
  archivedAt: string | null;
};

export async function listVillains(): Promise<VillainListItem[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("villains")
    .select(
      "id, name, slug, quote, description, icon_name, pill_variant, display_order, archived_at",
    )
    .order("display_order", { ascending: true });
  if (error) throw new Error(`listVillains: ${error.message}`);
  if (!data) return [];

  // Ativos primeiro (archived_at NULL), depois arquivados
  return data
    .map((v): VillainListItem => ({
      id: v.id,
      name: v.name,
      slug: v.slug,
      quote: v.quote,
      description: v.description,
      iconName: v.icon_name,
      pillVariant: v.pill_variant,
      displayOrder: v.display_order,
      archivedAt: v.archived_at,
    }))
    .sort((a, b) => {
      const archivedDelta =
        Number(a.archivedAt !== null) - Number(b.archivedAt !== null);
      if (archivedDelta !== 0) return archivedDelta;
      return a.displayOrder - b.displayOrder;
    });
}

export async function getVillain(id: string): Promise<VillainRow | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("villains")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getVillain: ${error.message}`);
  return data;
}
