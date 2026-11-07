import {
  CATALOG_GROUP_LABELS,
  type CatalogOfferGroup,
  catalogGroupSortIndex,
  isCatalogOfferGroup,
} from "@/lib/catalog/catalog-offer";

export type CatalogProductPick = {
  id: string;
  name: string;
  slug: string;
  catalog_group: CatalogOfferGroup | null;
  sort_order: number;
};

export type CatalogProductSection = {
  groupKey: CatalogOfferGroup | "other";
  label: string;
  products: CatalogProductPick[];
};

function groupSortIndex(group: CatalogOfferGroup | string | null): number {
  if (group && isCatalogOfferGroup(group)) return catalogGroupSortIndex(group);
  return 99;
}

export function compareCatalogProducts<
  T extends {
    catalog_group: CatalogOfferGroup | string | null;
    sort_order: number;
    name: string;
  },
>(a: T, b: T): number {
  const ga = groupSortIndex(a.catalog_group);
  const gb = groupSortIndex(b.catalog_group);
  if (ga !== gb) return ga - gb;
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.name.localeCompare(b.name, "pt-BR");
}

export type ActiveServiceProductPick = CatalogProductPick & {
  defaultCycleType?: string | null;
  catalogKind?: string;
};

export function groupActiveServiceProductSections(
  products: Array<{
    id: string;
    name: string;
    slug: string;
    catalogGroup: CatalogOfferGroup | null;
    sortOrder: number;
  }>,
): CatalogProductSection[] {
  return sectionCatalogProducts(
    products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      catalog_group: p.catalogGroup,
      sort_order: p.sortOrder,
    })),
  );
}

export function sectionCatalogProducts<T extends CatalogProductPick>(
  products: T[],
): CatalogProductSection[] {
  const sorted = [...products].sort(compareCatalogProducts);
  const sections: CatalogProductSection[] = [];
  let current: CatalogProductSection | null = null;

  for (const p of sorted) {
    const groupKey: CatalogOfferGroup | "other" =
      p.catalog_group && isCatalogOfferGroup(p.catalog_group)
        ? p.catalog_group
        : "other";
    const label =
      groupKey === "other" ? "Outros" : CATALOG_GROUP_LABELS[groupKey];

    if (!current || current.groupKey !== groupKey) {
      current = { groupKey, label, products: [p] };
      sections.push(current);
    } else {
      current.products.push(p);
    }
  }

  return sections;
}
