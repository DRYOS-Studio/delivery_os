import Link from "next/link";
import { StatusCycleButton } from "@/components/domain/StatusCycleButton";
import { Pill, type PillVariant } from "@/components/ui/Pill";
import type { CrossFrenteTaskRow } from "@/lib/db/queries/tasks";

type Props = {
  task: CrossFrenteTaskRow;
  showAssignee?: boolean;
};

function dueDatePill(
  dueDate: string | null,
  status: CrossFrenteTaskRow["status"],
): { text: string; variant: PillVariant } | null {
  if (!dueDate) return null;
  if (status === "done") return null;
  const due = new Date(`${dueDate}T23:59:59`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((due.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0)
    return { text: `Atrasada ${Math.abs(diffDays)}d`, variant: "critical" };
  if (diffDays === 0) return { text: "Hoje", variant: "warning" };
  if (diffDays <= 3) return { text: `Em ${diffDays}d`, variant: "oak" };
  return { text: formatShortDate(dueDate), variant: "neutral" };
}

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function MyTaskListItem({ task, showAssignee = false }: Props) {
  const duePill = dueDatePill(task.dueDate, task.status);
  const titleStyle =
    task.status === "done" ? "line-through text-mute" : "text-ink";
  const assigneeLabel = showAssignee
    ? task.assignees.length > 0
      ? task.assignees.map((a) => a.name).join(", ")
      : "Sem responsável"
    : null;
  const startLabel = task.startDate
    ? `início ${formatShortDate(task.startDate)}`
    : null;
  // Tarefa de área não tem Frente → edita pela rota de área.
  const editHref = task.areaId
    ? `/operations/${task.operationId}/areas/${task.id}/edit`
    : `/operations/${task.operationId}/frentes/${task.frenteId}/tasks/${task.id}/edit`;
  const contextLabel = task.area?.name ?? task.frenteName ?? "—";

  return (
    <li className="flex items-start gap-3 px-4 py-3 border-b border-line last:border-b-0">
      <div className="shrink-0 pt-0.5">
        <StatusCycleButton taskId={task.id} currentStatus={task.status} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {task.area && <Pill variant="oak">{task.area.name}</Pill>}
          <Link
            href={editHref}
            className={`font-medium ${titleStyle} hover:underline truncate`}
          >
            {task.title}
          </Link>
        </div>
        <p className="font-mono text-[10px] text-mute-soft truncate mt-0.5">
          {task.clientName} · {task.operationName} · {contextLabel}
          {assigneeLabel ? ` · ${assigneeLabel}` : ""}
          {startLabel ? ` · ${startLabel}` : ""}
        </p>
      </div>
      {duePill && (
        <div className="shrink-0">
          <Pill variant={duePill.variant}>{duePill.text}</Pill>
        </div>
      )}
    </li>
  );
}
