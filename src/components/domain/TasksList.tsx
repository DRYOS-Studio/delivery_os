import { MyTaskListItem } from "@/components/domain/MyTaskListItem";
import { TasksToolbar } from "@/components/domain/TasksToolbar";
import type { TaskScopeFilterOptions } from "@/lib/db/queries/task-scope-filters";
import type { InternalPersonItem } from "@/lib/db/queries/persons";
import {
  TASKS_PAGE_LIMIT,
  type CrossFrenteTaskRow,
  type TaskListFilter,
} from "@/lib/db/queries/tasks";
import {
  hasTaskListScope,
  type TaskListScope,
} from "@/lib/tasks/task-list-scope";

type Props = {
  tasks: CrossFrenteTaskRow[];
  filter: TaskListFilter;
  counts: { open: number; done: number; all: number };
  persons: InternalPersonItem[];
  selectedAssignee: string;
  myPersonId: string | null;
  scope: TaskListScope;
  scopeOptions: TaskScopeFilterOptions;
};

function emptyMessage(
  filter: TaskListFilter,
  scopedToAssignee: boolean,
  scopedToEntity: boolean,
): string {
  const suffix = scopedToAssignee
    ? " para este responsável"
    : scopedToEntity
      ? " com estes filtros"
      : "";

  if (filter === "open") {
    return scopedToAssignee || scopedToEntity
      ? `Nenhuma tarefa aberta${suffix}. Respira.`
      : "Nenhuma tarefa aberta. Respira.";
  }
  if (filter === "done") {
    return scopedToAssignee || scopedToEntity
      ? `Nenhuma tarefa concluída${suffix} ainda.`
      : "Nenhuma tarefa concluída ainda.";
  }
  return scopedToAssignee || scopedToEntity
    ? `Nenhuma tarefa${suffix}.`
    : "Nenhuma tarefa por aqui.";
}

export function TasksList({
  tasks,
  filter,
  counts,
  persons,
  selectedAssignee,
  myPersonId,
  scope,
  scopeOptions,
}: Props) {
  const showAssignee = selectedAssignee === "all";
  const scopedToEntity = hasTaskListScope(scope);
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
        scope={scope}
        scopeOptions={scopeOptions}
      />

      {tasks.length === 0 ? (
        <div className="bg-card border border-line rounded p-7 text-center">
          <p className="font-body text-sm text-mute">
            {emptyMessage(
              filter,
              selectedAssignee !== "all",
              scopedToEntity,
            )}
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
                Mostrando {TASKS_PAGE_LIMIT} de {total}. Refine por escopo,
                responsável ou aba pra ver o resto.
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
