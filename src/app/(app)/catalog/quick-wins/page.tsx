import { Plus } from "lucide-react";
import Link from "next/link";
import { QuickWinCatalogCard } from "@/components/domain/QuickWinCatalogCard";
import { QuickWinCatalogRow } from "@/components/domain/QuickWinCatalogRow";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import {
  CatalogViewToggle,
  normalizeCatalogView,
} from "@/components/ui/CatalogViewToggle";
import { getProfile } from "@/lib/auth/server";
import { listQuickWinCatalog } from "@/lib/db/queries/quick-win-catalog";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const [items, profile, { view: viewRaw }] = await Promise.all([
    listQuickWinCatalog(),
    getProfile(),
    searchParams,
  ]);
  const isAdmin = profile?.role === "admin";
  const view = normalizeCatalogView(viewRaw);
  const active = items.filter((i) => i.archivedAt === null);
  const archived = items.filter((i) => i.archivedAt !== null);

  return (
    <>
      <PageHeader
        title="Catálogo · Quick Wins"
        subtitle={`${active.length} tipos ativos. Pré-fill no form de QW da Operação.`}
        actions={
          <>
            <CatalogViewToggle basePath="/catalog/quick-wins" current={view} />
            <Link
              href="/catalog"
              className="font-mono text-xs text-oak hover:underline"
            >
              ← Vilões
            </Link>
            <Link
              href="/catalog/products"
              className="font-mono text-xs text-oak hover:underline"
            >
              Produtos →
            </Link>
            {isAdmin && (
              <Link href="/catalog/quick-wins/new">
                <Button variant="primary" size="sm">
                  <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                  Adicionar tipo
                </Button>
              </Link>
            )}
          </>
        }
      />

      {active.length === 0 ? (
        <div className="bg-card border border-line rounded p-7 text-center">
          <p className="font-body text-sm text-mute">
            Nenhum tipo ativo. Cadastre o primeiro.
          </p>
        </div>
      ) : view === "list" ? (
        <div className="bg-card border border-line rounded divide-y divide-line">
          {active.map((i) => (
            <QuickWinCatalogRow key={i.id} item={i} isAdmin={isAdmin} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {active.map((i) => (
            <QuickWinCatalogCard key={i.id} item={i} isAdmin={isAdmin} />
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
              {archived.map((i) => (
                <QuickWinCatalogRow key={i.id} item={i} isAdmin={isAdmin} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {archived.map((i) => (
                <QuickWinCatalogCard key={i.id} item={i} isAdmin={isAdmin} />
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
