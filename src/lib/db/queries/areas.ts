import { createServer } from "@/lib/db/client";

export type Area = {
  id: string;
  slug: string;
  name: string;
  archivedAt: string | null;
};

/** Áreas não-arquivadas (catálogo dinâmico). RLS deixa todo autenticado ler. */
export async function listAreas(): Promise<Area[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("areas")
    .select("id, slug, name, archived_at")
    .is("archived_at", null)
    .order("name", { ascending: true });
  if (error) throw new Error(`listAreas: ${error.message}`);
  return (data ?? []).map((a) => ({
    id: a.id,
    slug: a.slug,
    name: a.name,
    archivedAt: a.archived_at,
  }));
}
