import { ProductCard } from "@/components/domain/ProductCard";
import { ProductRow } from "@/components/domain/ProductRow";
import { isCatalogOfferGroup } from "@/lib/catalog/catalog-offer";
import { sectionCatalogProducts } from "@/lib/catalog/group-service-products";
import type { ServiceProductRow } from "@/lib/db/queries/service-products";

export function CatalogProductsSections({
  products,
  view,
  isAdmin,
}: {
  products: ServiceProductRow[];
  view: "grid" | "list";
  isAdmin: boolean;
}): React.JSX.Element {
  const sections = sectionCatalogProducts(
    products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      catalog_group:
        p.catalog_group && isCatalogOfferGroup(p.catalog_group)
          ? p.catalog_group
          : null,
      sort_order: p.sort_order,
    })),
  );

  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <section key={section.groupKey}>
          <h2 className="font-display text-base text-ink font-semibold mb-3">
            {section.label}
          </h2>
          {view === "list" ? (
            <div className="bg-card border border-line rounded divide-y divide-line">
              {section.products.map((summary) => {
                const product = products.find((p) => p.id === summary.id);
                if (!product) return null;
                return (
                  <ProductRow
                    key={product.id}
                    product={product}
                    isAdmin={isAdmin}
                  />
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {section.products.map((summary) => {
                const product = products.find((p) => p.id === summary.id);
                if (!product) return null;
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isAdmin={isAdmin}
                  />
                );
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
