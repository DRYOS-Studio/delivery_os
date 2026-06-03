import { Plus } from "lucide-react";
import Link from "next/link";
import { TasksList } from "@/components/domain/TasksList";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { requireProfile } from "@/lib/auth/server";
import { listInternalPersons } from "@/lib/db/queries/persons";
import { countTasks, listTasks, type TaskListFilter } from "@/lib/db/queries/tasks";

type SearchParams = Promise<{ filter?: string; assignee?: string }>;

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
  const { filter: rawFilter, assignee: rawAssignee } = await searchParams;
  const filter = parseFilter(rawFilter);

  // Resolve o responsável efetivo:
  //  - "all"            → todas as tarefas visíveis (RLS aplica gating)
  //  - <personId>       → só daquela pessoa
  //  - sem param        → minhas tarefas; cai pra "Todos" se não houver vínculo
  let effectiveAssignee: string | undefined;
  let selectedAssignee: string;
  if (rawAssignee === "all") {
    effectiveAssignee = undefined;
    selectedAssignee = "all";
  } else if (rawAssignee) {
    effectiveAssignee = rawAssignee;
    selectedAssignee = rawAssignee;
  } else {
    effectiveAssignee = profile.personId ?? undefined;
    selectedAssignee = profile.personId ?? "all";
  }

  const [tasks, counts, persons] = await Promise.all([
    listTasks(filter, effectiveAssignee),
    countTasks(effectiveAssignee),
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
      />
    </>
  );
}
