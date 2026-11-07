import { createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";
import { compareCatalogProducts } from "@/lib/catalog/group-service-products";
import type { CatalogOfferGroup, CatalogOfferKind } from "@/lib/catalog/catalog-offer";
import type { CycleType } from "@/lib/utils/cycle-type";

export type ServiceProductRow =
  Database["public"]["Tables"]["service_products"]["Row"];

export type ServiceProductListItem = {
  id: string;
  name: string;
  slug: string;
  defaultCycleType: CycleType | null;
  catalogGroup: CatalogOfferGroup | null;
  catalogKind: CatalogOfferKind;
  sortOrder: number;
};

function sortRows(rows: ServiceProductRow[]): ServiceProductRow[] {
  return [...rows].sort(compareCatalogProducts);
}

export async function listServiceProducts(): Promise<ServiceProductRow[]> {
  const supabase = await createServer();
  const { data, error } = await supabase.from("service_products").select("*");
  if (error) throw new Error(`listServiceProducts: ${error.message}`);
  return sortRows(data ?? []);
}

export async function listActiveServiceProducts(): Promise<
  ServiceProductListItem[]
> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("service_products")
    .select(
      "id, name, slug, default_cycle_type, catalog_group, catalog_kind, sort_order",
    )
    .is("archived_at", null);
  if (error) throw new Error(`listActiveServiceProducts: ${error.message}`);
  const items: ServiceProductListItem[] = (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    defaultCycleType: r.default_cycle_type,
    catalogGroup: r.catalog_group,
    catalogKind: r.catalog_kind,
    sortOrder: r.sort_order,
  }));
  items.sort((a, b) =>
    compareCatalogProducts(
      {
        catalog_group: a.catalogGroup,
        sort_order: a.sortOrder,
        name: a.name,
      },
      {
        catalog_group: b.catalogGroup,
        sort_order: b.sortOrder,
        name: b.name,
      },
    ),
  );
  return items;
}

function rowToListItem(row: ServiceProductRow, nameSuffix = ""): ServiceProductListItem {
  return {
    id: row.id,
    name: nameSuffix ? `${row.name}${nameSuffix}` : row.name,
    slug: row.slug,
    defaultCycleType: row.default_cycle_type,
    catalogGroup: row.catalog_group,
    catalogKind: row.catalog_kind,
    sortOrder: row.sort_order,
  };
}

/** Ativos para picker de Frente; inclui produto já vinculado se estiver arquivado (histórico). */
export async function listServiceProductsForFrenteForm(
  linkedProductId?: string | null,
): Promise<ServiceProductListItem[]> {
  const active = await listActiveServiceProducts();
  if (!linkedProductId || active.some((p) => p.id === linkedProductId)) {
    return active;
  }
  const linked = await getServiceProduct(linkedProductId);
  if (!linked) return active;
  const withLinked = [
    ...active,
    rowToListItem(linked, " (arquivado — vinculado)"),
  ];
  withLinked.sort((a, b) =>
    compareCatalogProducts(
      {
        catalog_group: a.catalogGroup,
        sort_order: a.sortOrder,
        name: a.name,
      },
      {
        catalog_group: b.catalogGroup,
        sort_order: b.sortOrder,
        name: b.name,
      },
    ),
  );
  return withLinked;
}

export async function getServiceProduct(
  id: string,
): Promise<ServiceProductRow | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("service_products")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getServiceProduct: ${error.message}`);
  return data;
}

export async function getServiceProductBySlug(
  slug: string,
): Promise<ServiceProductRow | null> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("service_products")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`getServiceProductBySlug: ${error.message}`);
  return data;
}
