import { notFound } from "next/navigation";
import { AreaTaskForm } from "@/components/domain/AreaTaskForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { getProfile, requireUser } from "@/lib/auth/server";
import { listAreas } from "@/lib/db/queries/areas";
import { getOperation } from "@/lib/db/queries/operations";
import { listInternalPersons } from "@/lib/db/queries/persons";
import { getTask } from "@/lib/db/queries/tasks";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; tid: string }>;
}) {
  await requireUser();
  const { id, tid } = await params;
  const [profile, operation, task, assignees, areas] = await Promise.all([
    getProfile(),
    getOperation(id),
    getTask(tid),
    listInternalPersons(),
    listAreas(),
  ]);
  if (!operation) notFound();
  // Só tarefa de área desta Operação.
  if (!task || task.operationId !== id || task.areaId === null) notFound();

  return (
    <>
      <PageHeader
        title="Editar tarefa de área"
        subtitle={`Operação: ${operation.name}`}
      />
      <AreaTaskForm
        mode="edit"
        operationId={id}
        initialData={task}
        assignees={assignees}
        areas={areas.map((a) => ({ id: a.id, name: a.name }))}
        isAdmin={profile?.role === "admin"}
      />
    </>
  );
}
