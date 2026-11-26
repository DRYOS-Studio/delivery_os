import { Package } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { SafeMarkdown } from "@/components/ui/SafeMarkdown";
import {
  CATALOG_GROUP_LABELS,
  CATALOG_KIND_LABELS,
  isCatalogOfferGroup,
} from "@/lib/catalog/catalog-offer";
import { getServiceProduct } from "@/lib/db/queries/service-products";
import { formatCycleTypeLong } from "@/lib/utils/cycle-type";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const product = await getServiceProduct(id);
  if (!product) notFound();

  const archived = product.archived_at !== null;

  return (
    <>
      <PageHeader
        title={product.name}
        subtitle="Escopo e descrição do produto no catálogo."
        actions={
          <>
            <Link
              href="/catalog/products"
              className="font-mono text-xs text-oak hover:underline"
            >
              ← Produtos
            </Link>
            <Link
              href={`/catalog/products/${product.id}/edit`}
              className="font-mono text-xs text-oak hover:underline"
            >
              Editar →
            </Link>
          </>
        }
      />

      <div className="max-w-3xl space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded flex items-center justify-center bg-oak-50 text-oak">
            <Package className="w-6 h-6" strokeWidth={1.75} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill variant="neutral">{product.slug}</Pill>
            {product.catalog_group && isCatalogOfferGroup(product.catalog_group) && (
              <Pill variant="sage">
                {CATALOG_GROUP_LABELS[product.catalog_group]}
              </Pill>
            )}
            {product.catalog_kind !== "product" && (
              <Pill variant="oak">{CATALOG_KIND_LABELS[product.catalog_kind]}</Pill>
            )}
            {product.default_cycle_type && (
              <Pill variant="neutral">
                {formatCycleTypeLong(product.default_cycle_type)}
              </Pill>
            )}
            {archived && <Pill variant="warning">Arquivado</Pill>}
          </div>
        </div>

        {product.content_ref && (
          <p className="font-mono text-xs text-mute">
            Ref. conteúdo:{" "}
            <span className="text-ink-soft">{product.content_ref}</span>
          </p>
        )}

        <section className="bg-card border border-line rounded p-6">
          {product.description ? (
            <SafeMarkdown source={product.description} />
          ) : (
            <p className="text-sm text-mute">Sem descrição cadastrada.</p>
          )}
        </section>
      </div>
    </>
  );
}