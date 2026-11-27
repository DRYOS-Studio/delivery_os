import {
  CATALOG_GROUP_LABELS,
  type CatalogOfferGroup,
  isCatalogOfferGroup,
} from "@/lib/catalog/catalog-offer";
import type { Database } from "@/lib/db/types";

type LegacyProductLine = Database["public"]["Enums"]["product_line"];

const LEGACY_PRODUCT_LINE_LABEL: Record<LegacyProductLine, string> = {
  core: "Core",
  spark: "Spark",
  studio: "Studio",
};

/** Rótulo de linha para UI: catalog_group primeiro; product_line legado como fallback. */
export function operationCatalogLineLabel(
  catalogGroup: CatalogOfferGroup | string | null | undefined,
  legacyProductLine: LegacyProductLine | null | undefined,
): string {
  if (catalogGroup && isCatalogOfferGroup(catalogGroup)) {
    return CATALOG_GROUP_LABELS[catalogGroup];
  }
  if (legacyProductLine) {
    return LEGACY_PRODUCT_LINE_LABEL[legacyProductLine];
  }
  return "—";
}

export function formatCatalogGroupActivityValue(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  if (isCatalogOfferGroup(raw)) return CATALOG_GROUP_LABELS[raw];
  return raw;
}