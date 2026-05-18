import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Pill, type PillVariant } from "@/components/ui/Pill";
import { DeleteTaskButton } from "@/components/domain/DeleteTaskButton";
import { StatusCycleButton } from "@/components/domain/StatusCycleButton";
import type { TaskRow } from "@/lib/db/queries/tasks";
import { getInitials } from "@/lib/utils/initials";

type Props = {
  task: TaskRow;
  operationId: string;
  isAdmin: boolean;
};

function dueDatePill(
  dueDate: string | null,
  status: TaskRow["status"],
): { text: string; variant: PillVariant } | null {
  if (!dueDate) return null;
  if (status === "done") return null;
  const due = new Date(`${dueDate}T23:59:59`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor(
    (due.getTime() - today.getTime()) / 86_400_000,
  );
  if (diffDays < 0)
    return {
      text: `Atrasada ${Math.abs(diffDays)}d`,
      variant: "critical",
    };
  if (diffDays === 0) return { text: "Hoje", variant: "warning" };
  if (diffDays <= 3) return { text: `Em ${diffDays}d`, variant: "oak" };
  return { text: formatShortDate(dueDate), variant: "neutral" };
}

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function TaskListItem({ task, operationId, isAdmin }: Props) {
  const duePill = dueDatePill(task.dueDate, task.status);
  const displayedTags = task.tags?.slice(0, 2) ?? [];
  const extraTagCount =
    task.tags && task.tags.length > 2 ? task.tags.length - 2 : 0;
  const titleStyle =
    task.status === "done" ? "line-through text-mute" : "text-ink";

  return (
    <li className="grid grid-cols-12 gap-3 items-center px-4 py-3 border-b border-line last:border-b-0">
      <div className="col-span-1 flex justify-center">
        <StatusCycleButton taskId={task.id} currentStatus={task.status} />
      </div>
      <div className="col-span-5 min-w-0">
        <Link
          href={`/operations/${operationId}/frentes/${task.frenteId}/tasks/${task.id}/edit`}
          className={`font-medium ${titleStyle} hover:underline truncate block`}
        >
          {task.title}
        </Link>
      </div>
      <div className="col-span-2 flex justify-center">
        {task.assigneeName ? (
          <div className="flex items-center gap-1.5">
            <Avatar
              size="sm"
              initials={getInitials(task.assigneeName)}
              color="oak"
              className="cursor-default"
            />
            <span className="font-mono text-[10px] text-mute truncate">
              {task.assigneeName}
            </span>
          </div>
        ) : (
          <span className="font-mono text-[10px] text-mute-soft">—</span>
        )}
      </div>
      <div className="col-span-2 flex justify-center">
        {duePill ? (
          <Pill variant={duePill.variant}>{duePill.text}</Pill>
        ) : (
          <span className="font-mono text-[10px] text-mute-soft">—</span>
        )}
      </div>
      <div className="col-span-1 flex flex-wrap gap-1 justify-end">
        {displayedTags.map((t) => (
          <Pill key={t} variant="neutral">
            {t}
          </Pill>
        ))}
        {extraTagCount > 0 && (
          <Pill variant="neutral">+{extraTagCount}</Pill>
        )}
      </div>
      <div className="col-span-1 flex justify-end">
        {isAdmin && (
          <DeleteTaskButton taskId={task.id} title={task.title} />
        )}
      </div>
    </li>
  );
}
