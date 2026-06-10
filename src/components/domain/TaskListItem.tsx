import { CornerDownRight, Plus } from "lucide-react";
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
  isSubtask?: boolean;
  subtasks?: { done: number; total: number } | undefined;
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

export function TaskListItem({
  task,
  operationId,
  isAdmin,
  isSubtask = false,
  subtasks,
}: Props) {
  const duePill = dueDatePill(task.dueDate, task.status);
  const displayedTags = task.tags?.slice(0, 2) ?? [];
  const extraTagCount =
    task.tags && task.tags.length > 2 ? task.tags.length - 2 : 0;
  const titleStyle =
    task.status === "done" ? "line-through text-mute" : "text-ink";
  const newSubtaskHref = `/operations/${operationId}/frentes/${task.frenteId}/tasks/new?parent=${task.id}`;

  return (
    <li
      className={`flex flex-col gap-2 px-4 py-3 border-b border-line last:border-b-0 md:grid md:grid-cols-12 md:gap-3 md:items-center ${
        isSubtask ? "bg-surface/40 md:pl-10" : ""
      }`}
    >
      <div className="flex items-center gap-3 md:contents">
        <div className="md:col-span-1 md:flex md:justify-center shrink-0">
          <StatusCycleButton taskId={task.id} currentStatus={task.status} />
        </div>
        <div className="md:col-span-5 flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {isSubtask && (
              <CornerDownRight
                className="w-3.5 h-3.5 text-mute-soft shrink-0"
                strokeWidth={1.75}
              />
            )}
            <Link
              href={`/operations/${operationId}/frentes/${task.frenteId}/tasks/${task.id}/edit`}
              className={`font-medium ${titleStyle} hover:underline md:truncate md:block`}
            >
              {task.title}
            </Link>
          </div>
          {!isSubtask && (
            <div className="flex items-center gap-2 mt-1">
              {subtasks && subtasks.total > 0 && (
                <span className="font-mono text-[10px] text-mute-soft">
                  {subtasks.done}/{subtasks.total} subtarefas
                </span>
              )}
              <Link
                href={newSubtaskHref}
                className="inline-flex items-center gap-0.5 font-mono text-[10px] text-mute-soft hover:text-ink"
              >
                <Plus className="w-3 h-3" strokeWidth={1.75} />
                subtarefa
              </Link>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 md:contents">
        <div className="md:col-span-2 md:flex md:justify-center">
          {task.assignees.length > 0 ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="flex -space-x-1.5 shrink-0">
                {task.assignees.slice(0, 3).map((a) => (
                  <Avatar
                    key={a.id}
                    size="sm"
                    initials={getInitials(a.name)}
                    color="oak"
                    className="cursor-default ring-1 ring-card"
                  />
                ))}
              </div>
              <span className="font-mono text-[10px] text-mute md:truncate">
                {task.assignees.length === 1
                  ? task.assignees[0]?.name
                  : `${task.assignees.length} pessoas`}
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
