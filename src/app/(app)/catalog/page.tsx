import Link from "next/link";
import { VillainCard } from "@/components/domain/VillainCard";
import { VillainRow } from "@/components/domain/VillainRow";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  CatalogViewToggle,
  normalizeCatalogView,
} from "@/components/ui/CatalogViewToggle";
import { getProfile } from "@/lib/auth/server";
import { listVillains } from "@/lib/db/queries/villains";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const [villains, profile, { view: viewRaw }] = await Promise.all([
    listVillains(),
    getProfile(),
    searchParams,
  ]);
  const isAdmin = profile?.role === "admin";
  const view = normalizeCatalogView(viewRaw);
  const activeCount = villains.filter((v) => v.archivedAt === null).length;

  return (
    <>
      <PageHeader
        title="Catálogo · Vilões"
        subtitle={`Universo de marca: os ${activeCount} vilões da ineficiência operacional.`}
        actions={
          <>
            <CatalogViewToggle basePath="/catalog" current={view} />
            <Link
              href="/catalog/products"
              className="font-mono text-xs text-oak hover:underline"
            >
              Ver produtos →
            </Link>
          </>
        }
      />

      {view === "list" ? (
        <div className="bg-card border border-line rounded divide-y divide-line">
          {villains.map((v) => (
            <VillainRow key={v.id} villain={v} isAdmin={isAdmin} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {villains.map((v) => (
            <VillainCard key={v.id} villain={v} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </>
  );
}
