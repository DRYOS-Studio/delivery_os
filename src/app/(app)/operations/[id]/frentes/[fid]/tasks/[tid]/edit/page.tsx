import { notFound } from "next/navigation";
import { TaskForm } from "@/components/domain/TaskForm";
import { TaskListItem } from "@/components/domain/TaskListItem";
import { PageHeader } from "@/components/layout/PageHeader";
import { getProfile, requireUser } from "@/lib/auth/server";
import { getFrenteDetail } from "@/lib/db/queries/frentes";
import { listIncidentsByOperation } from "@/lib/db/queries/incidents";
import { listInternalPersons } from "@/lib/db/queries/persons";
import { listQuickWinsByOperation } from "@/lib/db/queries/quick-wins";
import {
  getTask,
  listEligibleParents,
  listSubtasksOf,
} from "@/lib/db/queries/tasks";

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

  // Subtarefa não pode ter filhas (hierarquia de 1 nível, enforce_task_parent)
  // — pula a query em vez de confiar que ela voltaria vazia.
  const subtasks = task.parentTaskId === null ? await listSubtasksOf(tid) : [];
  // Task com subtarefas não pode virar subtarefa → não oferece pai.
  const childCount = subtasks.length;
  const parents =
    childCount > 0 ? [] : await listEligibleParents(fid, tid);
  const isAdmin = profile?.role === "admin";

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
        parents={parents}
        isAdmin={isAdmin}
      />
      {subtasks.length > 0 && (
        <section className="mt-9">
          <h2 className="font-display text-lg text-ink font-semibold mb-4">
            Subtarefas
          </h2>
          <div className="bg-card border border-line rounded shadow-sm overflow-hidden">
            <ul>
              {subtasks.map((s) => (
                <TaskListItem
                  key={s.id}
                  task={s}
                  operationId={id}
                  isAdmin={isAdmin}
                  isSubtask
                />
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
