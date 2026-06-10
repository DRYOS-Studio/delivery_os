import { Lock, Plus } from "lucide-react";
import Link from "next/link";
import { DeleteTaskButton } from "@/components/domain/DeleteTaskButton";
import { StatusCycleButton } from "@/components/domain/StatusCycleButton";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Pill, type PillVariant } from "@/components/ui/Pill";
import type { TaskRow } from "@/lib/db/queries/tasks";
import { getInitials } from "@/lib/utils/initials";

type Props = {
  tasks: TaskRow[];
  operationId: string;
  isAdmin: boolean;
  canCreate?: boolean;
};

function dueDatePill(
  dueDate: string | null,
  status: TaskRow["status"],
): { text: string; variant: PillVariant } | null {
  if (!dueDate || status === "done") return null;
  const due = new Date(`${dueDate}T23:59:59`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((due.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return { text: `Atrasada ${Math.abs(diff)}d`, variant: "critical" };
  if (diff === 0) return { text: "Hoje", variant: "warning" };
  if (diff <= 3) return { text: `Em ${diff}d`, variant: "oak" };
  const d = new Date(`${dueDate}T00:00:00`);
  return {
    text: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    variant: "neutral",
  };
}

export function AreaTasksSection({
  tasks,
  operationId,
  isAdmin,
  canCreate = false,
}: Props) {
  return (
    <section className="mb-9">
      <div className="flex items-center gap-2 mb-2">
        <Lock className="w-4 h-4 text-mute" strokeWidth={1.75} />
        <h2 className="font-display text-lg text-ink font-semibold">
          Área / Interno
        </h2>
        <Pill variant="neutral">{tasks.length}</Pill>
        {canCreate && (
          <div className="ml-auto">
            <Link href={`/operations/${operationId}/areas/new`}>
              <Button variant="sage" size="sm">
                <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                Nova tarefa de área
              </Button>
            </Link>
          </div>
        )}
      </div>
      <p className="font-body text-sm text-mute mb-4">
        Tarefas de CS, Financeiro e Jurídico — visíveis só a quem é da área (e
        admin), não ao restante da Operação.
      </p>

      {tasks.length === 0 ? (
        <div className="bg-card border border-line rounded p-7 text-center">
          <p className="font-body text-sm text-mute">
            Nenhuma tarefa de área visível pra você nesta Operação.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-line rounded shadow-sm overflow-hidden">
          <ul className="divide-y divide-line">
            {tasks.map((t) => {
              const duePill = dueDatePill(t.dueDate, t.status);
              const titleStyle =
                t.status === "done" ? "line-through text-mute" : "text-ink";
              return (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <StatusCycleButton taskId={t.id} currentStatus={t.status} />
                  <Link
                    href={`/operations/${operationId}/areas/${t.id}/edit`}
                    className={`flex-1 min-w-0 font-medium ${titleStyle} hover:underline truncate`}
                  >
                    {t.title}
                  </Link>
                  {t.area && <Pill variant="oak">{t.area.name}</Pill>}
                  {t.assignees.length > 0 && (
                    <div className="flex -space-x-1.5 shrink-0">
                      {t.assignees.slice(0, 3).map((a) => (
                        <Avatar
                          key={a.id}
                          size="sm"
                          initials={getInitials(a.name)}
                          color="oak"
                          className="cursor-default ring-1 ring-card"
                        />
                      ))}
                    </div>
                  )}
                  {duePill && <Pill variant={duePill.variant}>{duePill.text}</Pill>}
                  {isAdmin && <DeleteTaskButton taskId={t.id} title={t.title} />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
