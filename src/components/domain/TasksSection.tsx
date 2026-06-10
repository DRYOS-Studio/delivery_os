import { Plus } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { TaskListItem } from "@/components/domain/TaskListItem";
import type { TaskRow } from "@/lib/db/queries/tasks";
import { cn } from "@/lib/utils/cn";

type TaskFilter = "open" | "done" | "all";

type Props = {
  tasks: TaskRow[];
  frenteId: string;
  operationId: string;
  isAdmin: boolean;
  canWrite?: boolean;
  filter: TaskFilter;
  totalOpen: number;
  totalDone: number;
  totalAll: number;
  subtaskTotals: Record<string, { done: number; total: number }>;
};

const TABS: Array<{ key: TaskFilter; label: string }> = [
  { key: "open", label: "Abertas" },
  { key: "done", label: "Concluídas" },
  { key: "all", label: "Todas" },
];

function basePath(operationId: string, frenteId: string): string {
  return `/operations/${operationId}/frentes/${frenteId}`;
}

export function TasksSection({
  tasks,
  frenteId,
  operationId,
  isAdmin,
  canWrite = true,
  filter,
  totalOpen,
  totalDone,
  totalAll,
  subtaskTotals,
}: Props) {
  const counts: Record<TaskFilter, number> = {
    open: totalOpen,
    done: totalDone,
    all: totalAll,
  };

  // Agrupa o subset filtrado em pai → filhas. Filha cujo pai não está no subset
  // (ex: pai concluído, filha aberta sob filtro "abertas") cai como top-level.
  const visibleIds = new Set(tasks.map((t) => t.id));
  const topLevel = tasks.filter(
    (t) => !t.parentTaskId || !visibleIds.has(t.parentTaskId),
  );
  const childrenOf = (parentId: string): TaskRow[] =>
    tasks.filter((t) => t.parentTaskId === parentId);

  return (
    <section className="mb-9">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-display text-lg text-ink font-semibold">Tarefas</h2>
        <Pill variant="neutral">{totalOpen} abertas</Pill>
        {canWrite && (
          <div className="ml-auto">
            <Link href={`${basePath(operationId, frenteId)}/tasks/new`}>
              <Button variant="sage" size="sm">
                <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                Nova tarefa
              </Button>
            </Link>
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        {TABS.map((tab) => {
          const isActive = tab.key === filter;
          const href =
            tab.key === "open"
              ? basePath(operationId, frenteId)
              : `${basePath(operationId, frenteId)}?filter=${tab.key}`;
          return (
            <Link
              key={tab.key}
              href={href}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1 rounded text-xs font-mono uppercase tracking-wide transition-colors",
                isActive
                  ? "bg-ink text-bg"
                  : "bg-surface text-mute hover:text-ink",
              )}
            >
              {tab.label}
              <span className="text-[10px] opacity-70">{counts[tab.key]}</span>
            </Link>
          );
        })}
      </div>

      {tasks.length === 0 ? (
        <div className="bg-card border border-line rounded p-7 text-center">
          <p className="font-body text-sm text-mute mb-4">
            {filter === "open"
              ? "Nenhuma tarefa aberta por aqui."
              : filter === "done"
                ? "Nenhuma tarefa concluída ainda."
                : "Nenhuma tarefa cadastrada nesta Frente."}
          </p>
          {canWrite && (
            <Link href={`${basePath(operationId, frenteId)}/tasks/new`}>
              <Button variant="sage" size="sm">
                <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                Adicionar primeira tarefa
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-card border border-line rounded shadow-sm overflow-hidden">
          <ul>
            {topLevel.map((t) => (
              <Fragment key={t.id}>
                <TaskListItem
                  task={t}
                  operationId={operationId}
                  isAdmin={isAdmin}
                  subtasks={subtaskTotals[t.id]}
                />
                {childrenOf(t.id).map((c) => (
                  <TaskListItem
                    key={c.id}
                    task={c}
                    operationId={operationId}
                    isAdmin={isAdmin}
                    isSubtask
                  />
                ))}
              </Fragment>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
