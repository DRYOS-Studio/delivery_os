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
    <li className="flex flex-col gap-2 px-4 py-3 border-b border-line last:border-b-0 md:grid md:grid-cols-12 md:gap-3 md:items-center">
      <div className="flex items-center gap-3 md:contents">
        <div className="md:col-span-1 md:flex md:justify-center shrink-0">
          <StatusCycleButton taskId={task.id} currentStatus={task.status} />
        </div>
        <div className="md:col-span-5 flex-1 min-w-0">
          <Link
            href={`/operations/${operationId}/frentes/${task.frenteId}/tasks/${task.id}/edit`}
            className={`font-medium ${titleStyle} hover:underline md:truncate md:block`}
          >
            {task.title}
          </Link>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 md:contents">
        <div className="md:col-span-2 md:flex md:justify-center">
          {task.assigneeName ? (
            <div className="flex items-center gap-1.5">
              <Avatar
                size="sm"
                initials={getInitials(task.assigneeName)}
                color="oak"
                className="cursor-default"
              />
              <span className="font-mono text-[10px] text-mute md:truncate">
                {task.assigneeName}
              </span>
            </div>
          ) : (
            <span className="hidden md:inline font-mono text-[10px] text-mute-soft">
              —
            </span>
          )}
        </div>
        <div className="md:col-span-2 flex flex-col items-start gap-0.5 md:items-center">
          {duePill ? (
            <Pill variant={duePill.variant}>{duePill.text}</Pill>
          ) : (
            <span className="hidden md:inline font-mono text-[10px] text-mute-soft">
              —
            </span>
          )}
          {task.startDate && (
            <span className="font-mono text-[10px] text-mute-soft">
              início {formatShortDate(task.startDate)}
            </span>
          )}
        </div>
        <div className="md:col-span-1 flex flex-wrap gap-1 md:justify-end">
          {displayedTags.map((t) => (
            <Pill key={t} variant="neutral">
              {t}
            </Pill>
          ))}
          {extraTagCount > 0 && (
            <Pill variant="neutral">+{extraTagCount}</Pill>
          )}
        </div>
      </div>
      <div className="md:col-span-1 md:flex md:justify-end">
        {isAdmin && (
          <DeleteTaskButton taskId={task.id} title={task.title} />
        )}
      </div>
    </li>
  );
}
