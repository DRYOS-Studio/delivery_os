import { MyTasksList } from "@/components/domain/MyTasksList";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireProfile } from "@/lib/auth/server";
import {
  countMyTasks,
  listMyTasks,
  type MyTaskFilter,
} from "@/lib/db/queries/tasks";

type SearchParams = Promise<{ filter?: string }>;

function parseFilter(raw: string | undefined): MyTaskFilter {
  if (raw === "done" || raw === "all") return raw;
  return "open";
}

export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireProfile("/me/tasks");

  if (!profile.personId) {
    return (
      <>
        <PageHeader
          title="Minhas Tasks"
          subtitle="Tudo o que está atribuído a você, em um só lugar"
        />
        <div className="bg-card border border-line rounded p-7 text-center">
          <p className="font-body text-sm text-mute">
            Seu usuário ainda não está vinculado a uma Pessoa. Peça a um admin
            para ligar seu login à sua ficha de Pessoa interna — aí suas tarefas
            aparecem aqui.
          </p>
        </div>
      </>
    );
  }

  const { filter: rawFilter } = await searchParams;
  const filter = parseFilter(rawFilter);

  const [tasks, counts] = await Promise.all([
    listMyTasks(profile.personId, filter),
    countMyTasks(profile.personId),
  ]);

  const subtitle = `${counts.open} ${counts.open === 1 ? "tarefa aberta" : "tarefas abertas"}`;

  return (
    <>
      <PageHeader title="Minhas Tasks" subtitle={subtitle} />
      <MyTasksList tasks={tasks} filter={filter} counts={counts} />
    </>
  );
}
