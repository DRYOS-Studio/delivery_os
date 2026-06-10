import { notFound } from "next/navigation";
import Link from "next/link";
import { FrenteMetaCard } from "@/components/domain/FrenteMetaCard";
import { TasksSection } from "@/components/domain/TasksSection";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { getProfile, requireUser } from "@/lib/auth/server";
import { getFrenteDetail } from "@/lib/db/queries/frentes";
import { listTasksByFrente, type TaskRow } from "@/lib/db/queries/tasks";

type Filter = "open" | "done" | "all";

function applyFilter(tasks: TaskRow[], filter: Filter): TaskRow[] {
  if (filter === "all") return tasks;
  if (filter === "done") return tasks.filter((t) => t.status === "done");
  return tasks.filter((t) => t.status !== "done");
}

function normalizeFilter(raw: string | undefined): Filter {
  if (raw === "done" || raw === "all") return raw;
  return "open";
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; fid: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireUser();
  const { id, fid } = await params;
  const { filter: filterRaw } = await searchParams;
  const filter = normalizeFilter(filterRaw);

  const [profile, frente, tasks] = await Promise.all([
    getProfile(),
    getFrenteDetail(fid),
    listTasksByFrente(fid),
  ]);
  if (!frente || frente.operationId !== id) notFound();

  const isAdmin = profile?.role === "admin";
  const filtered = applyFilter(tasks, filter);
  // Contagem de Frente exclui subtarefas pra não inflar o "abertas" do header.
  const topLevel = tasks.filter((t) => !t.parentTaskId);
  const totalOpen = topLevel.filter((t) => t.status !== "done").length;
  const totalDone = topLevel.filter((t) => t.status === "done").length;
  const totalAll = topLevel.length;

  // Totais de subtarefas por pai (lista completa, independe do filtro de status).
  const subtaskTotals: Record<string, { done: number; total: number }> = {};
  for (const t of tasks) {
    if (!t.parentTaskId) continue;
    const acc = (subtaskTotals[t.parentTaskId] ??= { done: 0, total: 0 });
    acc.total += 1;
    if (t.status === "done") acc.done += 1;
  }

  return (
    <>
      <PageHeader
        title={frente.name}
        subtitle={
          <Link
            href={`/operations/${id}`}
            className="text-mute hover:text-ink"
          >
            ← Voltar para Operação
          </Link>
        }
        actions={
          <Link href={`/operations/${id}/frentes/${fid}/tasks/new`}>
            <Button variant="sage" size="sm">
              + Nova tarefa
            </Button>
          </Link>
        }
      />
      <FrenteMetaCard frente={frente} />
      <TasksSection
        tasks={filtered}
        frenteId={fid}
        operationId={id}
        isAdmin={isAdmin}
        filter={filter}
        totalOpen={totalOpen}
        totalDone={totalDone}
        totalAll={totalAll}
        subtaskTotals={subtaskTotals}
      />
    </>
  );
}
