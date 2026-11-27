import { Plus } from "lucide-react";
import Link from "next/link";
import { TasksList } from "@/components/domain/TasksList";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { requireProfile } from "@/lib/auth/server";
import { listInternalPersons } from "@/lib/db/queries/persons";
import { listTaskScopeFilterOptions } from "@/lib/db/queries/task-scope-filters";
import { countTasks, listTasks, type TaskListFilter } from "@/lib/db/queries/tasks";
import {
  parseTaskListScopeParams,
  resolveTaskListScope,
} from "@/lib/tasks/task-list-scope";

type SearchParams = Promise<{
  filter?: string;
  assignee?: string;
  client_id?: string;
  operation_id?: string;
  frente_id?: string;
}>;

function parseFilter(raw: string | undefined): TaskListFilter {
  if (raw === "done" || raw === "all") return raw;
  return "open";
}

export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireProfile("/tasks");
  const raw = await searchParams;
  const filter = parseFilter(raw.filter);

  let effectiveAssignee: string | undefined;
  let selectedAssignee: string;
  if (raw.assignee === "all") {
    effectiveAssignee = undefined;
    selectedAssignee = "all";
  } else if (raw.assignee) {
    effectiveAssignee = raw.assignee;
    selectedAssignee = raw.assignee;
  } else {
    effectiveAssignee = profile.personId ?? undefined;
    selectedAssignee = profile.personId ?? "all";
  }

  const scopeOptions = await listTaskScopeFilterOptions();
  const scope = resolveTaskListScope(
    parseTaskListScopeParams(raw),
    scopeOptions,
  );

  const [tasks, counts, persons] = await Promise.all([
    listTasks(filter, effectiveAssignee, scope),
    countTasks(effectiveAssignee, scope),
    listInternalPersons(),
  ]);

  const subtitle = `${counts.open} ${counts.open === 1 ? "tarefa aberta" : "tarefas abertas"}`;

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle={subtitle}
        actions={
          <Link href="/tasks/new">
            <Button variant="sage">
              <Plus className="w-4 h-4" strokeWidth={1.75} />
              Criar tarefa
            </Button>
          </Link>
        }
      />
      <TasksList
        tasks={tasks}
        filter={filter}
        counts={counts}
        persons={persons}
        selectedAssignee={selectedAssignee}
        myPersonId={profile.personId}
        scope={scope}
        scopeOptions={scopeOptions}
      />
    </>
  );
}