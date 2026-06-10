import { notFound } from "next/navigation";
import { AreaTaskForm } from "@/components/domain/AreaTaskForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { getProfile, requireUser } from "@/lib/auth/server";
import { listCreatableAreasForOperation } from "@/lib/db/queries/areas";
import { getOperation } from "@/lib/db/queries/operations";
import { listInternalPersons } from "@/lib/db/queries/persons";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";
  const [operation, assignees, areas] = await Promise.all([
    getOperation(id),
    listInternalPersons(),
    listCreatableAreasForOperation(id, isAdmin),
  ]);
  if (!operation) notFound();
  // Sem áreas criáveis aqui (nem admin, nem membro de área com concessão).
  if (areas.length === 0) notFound();

  return (
    <>
      <PageHeader
        title="Nova tarefa de área"
        subtitle={`Operação: ${operation.name}`}
      />
      <AreaTaskForm
        mode="create"
        operationId={id}
        assignees={assignees}
        areas={areas.map((a) => ({ id: a.id, name: a.name }))}
        isAdmin={isAdmin}
      />
    </>
  );
}
