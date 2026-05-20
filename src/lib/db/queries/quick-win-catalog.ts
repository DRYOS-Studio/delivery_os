import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type QuickWinCatalogRow =
  Database["public"]["Tables"]["quick_win_catalog"]["Row"];

export type SuggestedVillain = {
  id: string;
  name: string;
  slug: string;
  iconName: string;
  pillVariant: string;
  archivedAt: string | null;
};

export type QuickWinCatalogListItem = {
  id: string;
  title: string;
  description: string | null;
  defaultImpactPct: number | null;
  suggestedVillainId: string | null;
  suggestedVillain: SuggestedVillain | null;
  archivedAt: string | null;
};

const SELECT_WITH_VILLAIN = `
  id, title, description, suggested_villain_id, default_impact_pct, archived_at,
  villain:villains!fk_qwc_villain (
    id, name, slug, icon_name, pill_variant, archived_at
  )
`;

type RawJoin = {
  id: string;
  title: string;
  description: string | null;
  suggested_villain_id: string | null;
  default_impact_pct: number | null;
  archived_at: string | null;
  villain:
    | {
        id: string;
        name: string;
        slug: string;
        icon_name: string;
        pill_variant: string;
        archived_at: string | null;
      }
    | Array<{
        id: string;
        name: string;
        slug: string;
        icon_name: string;
        pill_variant: string;
        archived_at: string | null;
      }>
    | null;
};

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function mapRow(r: RawJoin): QuickWinCatalogListItem {
  const v = pickOne(r.villain);
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    defaultImpactPct: r.default_impact_pct,
    suggestedVillainId: r.suggested_villain_id,
    archivedAt: r.archived_at,
    suggestedVillain: v
      ? {
          id: v.id,
          name: v.name,
          slug: v.slug,
          iconName: v.icon_name,
          pillVariant: v.pill_variant,
          archivedAt: v.archived_at,
        }
      : null,
  };
}

export async function listQuickWinCatalog(): Promise<QuickWinCatalogListItem[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("quick_win_catalog")
    .select(SELECT_WITH_VILLAIN)
    .order("title", { ascending: true });
  if (error) throw new Error(`listQuickWinCatalog: ${error.message}`);
  return (data ?? []).map((r) => mapRow(r as RawJoin));
}

export async function listActiveQuickWinCatalog(): Promise<
  QuickWinCatalogListItem[]
> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("quick_win_catalog")
    .select(SELECT_WITH_VILLAIN)
    .is("archived_at", null)
    .order("title", { ascending: true });
  if (error) throw new Error(`listActiveQuickWinCatalog: ${error.message}`);
  return (data ?? []).map((r) => mapRow(r as RawJoin));
}

export async function getQuickWinCatalogItem(
  id: string,
): Promise<QuickWinCatalogRow | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("quick_win_catalog")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getQuickWinCatalogItem: ${error.message}`);
  return data;
}
