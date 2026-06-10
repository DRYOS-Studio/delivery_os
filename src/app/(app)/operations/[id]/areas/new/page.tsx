import { notFound } from "next/navigation";
import { AreaTaskForm } from "@/components/domain/AreaTaskForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdmin } from "@/lib/auth/server";
import { listAreas } from "@/lib/db/queries/areas";
import { getOperation } from "@/lib/db/queries/operations";
import { listInternalPersons } from "@/lib/db/queries/persons";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [operation, assignees, areas] = await Promise.all([
    getOperation(id),
    listInternalPersons(),
    listAreas(),
  ]);
  if (!operation) notFound();

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
        isAdmin
      />
    </>
  );
}
