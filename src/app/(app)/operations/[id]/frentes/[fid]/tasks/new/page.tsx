import { notFound } from "next/navigation";
import { TaskForm } from "@/components/domain/TaskForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { getProfile, requireUser } from "@/lib/auth/server";
import { getFrenteDetail } from "@/lib/db/queries/frentes";
import { listIncidentsByOperation } from "@/lib/db/queries/incidents";
import { listInternalPersons } from "@/lib/db/queries/persons";
import { listQuickWinsByOperation } from "@/lib/db/queries/quick-wins";
import { listEligibleParents } from "@/lib/db/queries/tasks";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; fid: string }>;
  searchParams: Promise<{ parent?: string }>;
}) {
  await requireUser();
  const { id, fid } = await params;
  const { parent } = await searchParams;
  const [profile, frente, assignees, quickWins, incidents, parents] =
    await Promise.all([
      getProfile(),
      getFrenteDetail(fid),
      listInternalPersons(),
      listQuickWinsByOperation(id),
      listIncidentsByOperation(id, { excludeCancelled: true }),
      listEligibleParents(fid),
    ]);
  if (!frente || frente.operationId !== id) notFound();

  // ?parent= só vale se for um pai elegível (top-level desta Frente).
  const defaultParentId =
    parent && parents.some((p) => p.id === parent) ? parent : undefined;

  return (
    <>
      <PageHeader
        title={defaultParentId ? "Nova subtarefa" : "Nova tarefa"}
        subtitle={`Frente: ${frente.name}`}
      />
      <TaskForm
        mode="create"
        frenteId={fid}
        operationId={id}
        {...(defaultParentId ? { defaultParentId } : {})}
        assignees={assignees}
        quickWins={quickWins.map((q) => ({ id: q.id, title: q.title }))}
        incidents={incidents.map((i) => ({ id: i.id, title: i.title }))}
        parents={parents}
        isAdmin={profile?.role === "admin"}
      />
    </>
  );
}
