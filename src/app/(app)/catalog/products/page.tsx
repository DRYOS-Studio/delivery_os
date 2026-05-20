import { Plus } from "lucide-react";
import Link from "next/link";
import { ProductCard } from "@/components/domain/ProductCard";
import { ProductRow } from "@/components/domain/ProductRow";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import {
  CatalogViewToggle,
  normalizeCatalogView,
} from "@/components/ui/CatalogViewToggle";
import { getProfile } from "@/lib/auth/server";
import { listServiceProducts } from "@/lib/db/queries/service-products";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const [products, profile, { view: viewRaw }] = await Promise.all([
    listServiceProducts(),
    getProfile(),
    searchParams,
  ]);
  const isAdmin = profile?.role === "admin";
  const view = normalizeCatalogView(viewRaw);
  const active = products.filter((p) => p.archived_at === null);
  const archived = products.filter((p) => p.archived_at !== null);

  return (
    <>
      <PageHeader
        title="Catálogo · Produtos & Serviços"
        subtitle={`${active.length} ativos. Catálogo da DRYOS — referência pra Frentes.`}
        actions={
          <>
            <CatalogViewToggle basePath="/catalog/products" current={view} />
            <Link
              href="/catalog"
              className="font-mono text-xs text-oak hover:underline"
            >
              ← Vilões
            </Link>
            {isAdmin && (
              <Link href="/catalog/products/new">
                <Button variant="primary" size="sm">
                  <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                  Adicionar produto
                </Button>
              </Link>
            )}
          </>
        }
      />

      {active.length === 0 ? (
        <div className="bg-card border border-line rounded p-7 text-center">
          <p className="font-body text-sm text-mute">
            Nenhum produto ativo. Cadastre o primeiro.
          </p>
        </div>
      ) : view === "list" ? (
        <div className="bg-card border border-line rounded divide-y divide-line">
          {active.map((p) => (
            <ProductRow key={p.id} product={p} isAdmin={isAdmin} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {active.map((p) => (
            <ProductCard key={p.id} product={p} isAdmin={isAdmin} />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-base text-ink font-semibold mb-3">
            Arquivados
            <span className="font-mono text-[10px] text-mute uppercase tracking-wide ml-2">
              {archived.length}
            </span>
          </h2>
          {view === "list" ? (
            <div className="bg-card border border-line rounded divide-y divide-line">
              {archived.map((p) => (
                <ProductRow key={p.id} product={p} isAdmin={isAdmin} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {archived.map((p) => (
                <ProductCard key={p.id} product={p} isAdmin={isAdmin} />
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
