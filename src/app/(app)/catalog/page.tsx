import { VillainCard } from "@/components/domain/VillainCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { listVillains } from "@/lib/db/queries/villains";

export default async function Page() {
  const villains = await listVillains();
  const activeCount = villains.filter((v) => v.archivedAt === null).length;

  return (
    <>
      <PageHeader
        title="Catálogo"
        subtitle={`Universo de marca: os ${activeCount} vilões da ineficiência operacional.`}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {villains.map((v) => (
          <VillainCard key={v.id} villain={v} />
        ))}
      </div>
    </>
  );
}
