import { notFound } from "next/navigation";
import { TaskForm } from "@/components/domain/TaskForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { getProfile, requireUser } from "@/lib/auth/server";
import { getFrenteDetail } from "@/lib/db/queries/frentes";
import { listIncidentsByOperation } from "@/lib/db/queries/incidents";
import { listInternalPersons } from "@/lib/db/queries/persons";
import { listQuickWinsByOperation } from "@/lib/db/queries/quick-wins";
import { getTask } from "@/lib/db/queries/tasks";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; fid: string; tid: string }>;
}) {
  await requireUser();
  const { id, fid, tid } = await params;
  const [profile, frente, task, assignees, quickWins, incidents] = await Promise.all([
    getProfile(),
    getFrenteDetail(fid),
    getTask(tid),
    listInternalPersons(),
    listQuickWinsByOperation(id),
    listIncidentsByOperation(id, { excludeCancelled: true }),
  ]);
  if (!frente || frente.operationId !== id) notFound();
  if (!task || task.frenteId !== fid) notFound();

  return (
    <>
      <PageHeader
        title="Editar tarefa"
        subtitle={`Frente: ${frente.name}`}
      />
      <TaskForm
        mode="edit"
        frenteId={fid}
        operationId={id}
        initialData={task}
        assignees={assignees}
        quickWins={quickWins.map((q) => ({ id: q.id, title: q.title }))}
        incidents={incidents.map((i) => ({ id: i.id, title: i.title }))}
        isAdmin={profile?.role === "admin"}
      />
    </>
  );
}
