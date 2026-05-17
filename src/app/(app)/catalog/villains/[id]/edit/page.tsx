import { redirect } from "next/navigation";
import { ArchiveVillainButton } from "@/components/domain/ArchiveVillainButton";
import { VillainForm } from "@/components/domain/VillainForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { getVillain } from "@/lib/db/queries/villains";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) redirect("/catalog");

  const villain = await getVillain(id);
  if (!villain) redirect("/catalog");

  return (
    <>
      <PageHeader
        title={`Editar — ${villain.name}`}
        subtitle="Universo de marca · vilão canon"
        actions={
          <ArchiveVillainButton
            villainId={villain.id}
            villainName={villain.name}
            archivedAt={villain.archived_at}
          />
        }
      />
      <VillainForm initialData={villain} />
    </>
  );
}
