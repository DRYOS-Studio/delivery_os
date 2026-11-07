/** Catálogo comercial alinhado a DRYOS-Studio/dryos-conteudo (main). */

export const CATALOG_OFFER_GROUPS = [
  "funcionarios_digitais",
  "automacoes",
  "dryos_os",
  "studio",
] as const;

export type CatalogOfferGroup = (typeof CATALOG_OFFER_GROUPS)[number];

export const CATALOG_OFFER_KINDS = ["product", "plan", "studio_category"] as const;

export type CatalogOfferKind = (typeof CATALOG_OFFER_KINDS)[number];

export const CATALOG_GROUP_LABELS: Record<CatalogOfferGroup, string> = {
  funcionarios_digitais: "Funcionários Digitais",
  automacoes: "Automações",
  dryos_os: "DRYOS OS",
  studio: "Studio",
};

export const CATALOG_KIND_LABELS: Record<CatalogOfferKind, string> = {
  product: "Oferta",
  plan: "Plano",
  studio_category: "Categoria Studio",
};

/** Slugs do seed legado (Core/Spark/Studio/Evergreen) — únicos elegíveis para arquivamento automático na migration de reconciliação. */
export const LEGACY_SERVICE_PRODUCT_SLUGS = [
  "core",
  "spark-inbox",
  "spark-bridge",
  "spark-specialist",
  "spark-pulse",
  "spark-cobra",
  "studio-launch",
  "studio-custom",
  "studio-insight",
  "studio-bridge-plus",
  "studio-agent",
  "evergreen",
] as const;

export function isCatalogOfferGroup(value: string): value is CatalogOfferGroup {
  return (CATALOG_OFFER_GROUPS as readonly string[]).includes(value);
}

export function catalogGroupSortIndex(group: CatalogOfferGroup | null): number {
  if (!group) return 99;
  return CATALOG_OFFER_GROUPS.indexOf(group);
}
