import Link from "next/link";
import { VillainCard } from "@/components/domain/VillainCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { getProfile } from "@/lib/auth/server";
import { listVillains } from "@/lib/db/queries/villains";

export default async function Page() {
  const villains = await listVillains();
  const activeCount = villains.filter((v) => v.archivedAt === null).length;
  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";

  return (
    <>
      <PageHeader
        title="Catálogo · Vilões"
        subtitle={`Universo de marca: os ${activeCount} vilões da ineficiência operacional.`}
        actions={
          <Link
            href="/catalog/products"
            className="font-mono text-xs text-oak hover:underline"
          >
            Ver produtos →
          </Link>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {villains.map((v) => (
          <VillainCard key={v.id} villain={v} isAdmin={isAdmin} />
        ))}
      </div>
    </>
  );
}
