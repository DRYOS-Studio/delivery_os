import { MyTaskListItem } from "@/components/domain/MyTaskListItem";
import { TasksToolbar } from "@/components/domain/TasksToolbar";
import type { InternalPersonItem } from "@/lib/db/queries/persons";
import {
  TASKS_PAGE_LIMIT,
  type CrossFrenteTaskRow,
  type TaskListFilter,
} from "@/lib/db/queries/tasks";

type Props = {
  tasks: CrossFrenteTaskRow[];
  filter: TaskListFilter;
  counts: { open: number; done: number; all: number };
  persons: InternalPersonItem[];
  selectedAssignee: string;
  myPersonId: string | null;
};

function emptyMessage(filter: TaskListFilter, scopedToOne: boolean): string {
  if (filter === "open") {
    return scopedToOne
      ? "Nenhuma tarefa aberta para este responsável. Respira."
      : "Nenhuma tarefa aberta. Respira.";
  }
  if (filter === "done") {
    return scopedToOne
      ? "Nenhuma tarefa concluída por este responsável ainda."
      : "Nenhuma tarefa concluída ainda.";
  }
  return scopedToOne
    ? "Nenhuma tarefa para este responsável."
    : "Nenhuma tarefa por aqui.";
}

export function TasksList({
  tasks,
  filter,
  counts,
  persons,
  selectedAssignee,
  myPersonId,
}: Props) {
  const showAssignee = selectedAssignee === "all";
  // `counts` vem de countTasks (total real, sem teto); `tasks` já vem cortado
  // em TASKS_PAGE_LIMIT. A diferença é o que a lista não está mostrando.
  const total = counts[filter];
  const truncated = total > tasks.length;

  return (
    <section>
      <TasksToolbar
        filter={filter}
        counts={counts}
        persons={persons}
        selectedAssignee={selectedAssignee}
        myPersonId={myPersonId}
      />

      {tasks.length === 0 ? (
        <div className="bg-card border border-line rounded p-7 text-center">
          <p className="font-body text-sm text-mute">
            {emptyMessage(filter, selectedAssignee !== "all")}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-line rounded shadow-sm overflow-hidden">
          <ul>
            {tasks.map((t) => (
              <MyTaskListItem
                key={t.id}
                task={t}
                showAssignee={showAssignee}
              />
            ))}
            {truncated && (
              <li className="text-xs text-mute font-mono">
                Mostrando {TASKS_PAGE_LIMIT} de {total}. Refine por responsável
                ou aba pra ver o resto.
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
