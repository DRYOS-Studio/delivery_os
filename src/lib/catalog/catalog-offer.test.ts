import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CATALOG_OFFER_GROUPS,
  LEGACY_SERVICE_PRODUCT_SLUGS,
} from "@/lib/catalog/catalog-offer";
import {
  compareCatalogProducts,
  sectionCatalogProducts,
} from "@/lib/catalog/group-service-products";

describe("catalog-offer", () => {
  it("legacy slug list stays in sync with migration archive array", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20261107013000_catalog_conteudo_v2.sql",
      ),
      "utf8",
    );
    const match = sql.match(
      /AND slug = ANY \(\s*ARRAY\[([\s\S]*?)\]::text\[\]\s*\)/,
    );
    expect(match).toBeTruthy();
    const body = match?.[1] ?? "";
    const slugs = [...body.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
    expect(slugs.sort()).toEqual([...LEGACY_SERVICE_PRODUCT_SLUGS].sort());
  });

  it("groups Studio categories after umbrella product by sort_order", () => {
    const items = [
      {
        id: "1",
        name: "Desenvolvimento",
        slug: "studio-desenvolvimento",
        catalog_group: "studio" as const,
        sort_order: 6,
      },
      {
        id: "2",
        name: "Projetos sob medida",
        slug: "studio-projetos-sob-medida",
        catalog_group: "studio" as const,
        sort_order: 0,
      },
      {
        id: "3",
        name: "Consultoria",
        slug: "studio-consultoria",
        catalog_group: "studio" as const,
        sort_order: 1,
      },
    ];
    const ordered = [...items].sort(compareCatalogProducts);
    expect(ordered.map((i) => i.slug)).toEqual([
      "studio-projetos-sob-medida",
      "studio-consultoria",
      "studio-desenvolvimento",
    ]);
  });

  it("builds four commercial group sections", () => {
    const products = CATALOG_OFFER_GROUPS.flatMap((g, gi) => [
      {
        id: `${g}-a`,
        name: `${g}-a`,
        slug: `${g}-a`,
        catalog_group: g,
        sort_order: gi,
      },
    ]);
    const sections = sectionCatalogProducts(products);
    expect(sections.map((s) => s.groupKey)).toEqual([...CATALOG_OFFER_GROUPS]);
  });
});
