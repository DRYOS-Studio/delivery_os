import { notFound } from "next/navigation";
import { TaskForm } from "@/components/domain/TaskForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { getProfile, requireUser } from "@/lib/auth/server";
import { getFrenteDetail } from "@/lib/db/queries/frentes";
import { listIncidentsByOperation } from "@/lib/db/queries/incidents";
import { listInternalPersons } from "@/lib/db/queries/persons";
import { listQuickWinsByOperation } from "@/lib/db/queries/quick-wins";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; fid: string }>;
}) {
  await requireUser();
  const { id, fid } = await params;
  const [profile, frente, assignees, quickWins, incidents] = await Promise.all([
    getProfile(),
    getFrenteDetail(fid),
    listInternalPersons(),
    listQuickWinsByOperation(id),
    listIncidentsByOperation(id, { excludeCancelled: true }),
  ]);
  if (!frente || frente.operationId !== id) notFound();

  return (
    <>
      <PageHeader
        title="Nova tarefa"
        subtitle={`Frente: ${frente.name}`}
      />
      <TaskForm
        mode="create"
        frenteId={fid}
        operationId={id}
        assignees={assignees}
        quickWins={quickWins.map((q) => ({ id: q.id, title: q.title }))}
        incidents={incidents.map((i) => ({ id: i.id, title: i.title }))}
        isAdmin={profile?.role === "admin"}
      />
    </>
  );
}
