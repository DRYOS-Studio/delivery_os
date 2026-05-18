"use client";

import { AlertOctagon, CheckSquare, CircleDashed, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { changeTaskStatusAction } from "@/lib/actions/tasks";
import type { TaskStatus } from "@/lib/db/queries/tasks";

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  todo: "doing",
  doing: "done",
  done: "todo",
  blocked: "blocked",
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "A fazer",
  doing: "Em andamento",
  done: "Concluída",
  blocked: "Bloqueada",
};

export function StatusCycleButton({
  taskId,
  currentStatus,
}: {
  taskId: string;
  currentStatus: TaskStatus;
}): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (currentStatus === "blocked") return;
    setBusy(true);
    const next = NEXT_STATUS[currentStatus];
    const result = await changeTaskStatusAction(taskId, next);
    if (result.ok) {
      router.refresh();
    } else {
      window.alert(`Erro: ${result.error}`);
    }
    setBusy(false);
  }

  const Icon =
    currentStatus === "done"
      ? CheckSquare
      : currentStatus === "doing"
        ? CircleDashed
        : currentStatus === "blocked"
          ? AlertOctagon
          : Square;

  const color =
    currentStatus === "done"
      ? "text-sage-deep"
      : currentStatus === "doing"
        ? "text-oak"
        : currentStatus === "blocked"
          ? "text-warning"
          : "text-mute";

  const cursor =
    currentStatus === "blocked" ? "cursor-default" : "cursor-pointer";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || currentStatus === "blocked"}
      title={
        currentStatus === "blocked"
          ? "Bloqueada — edite a tarefa pra mudar"
          : `${STATUS_LABEL[currentStatus]} → ${STATUS_LABEL[NEXT_STATUS[currentStatus]]}`
      }
      className={`inline-flex items-center justify-center w-6 h-6 ${color} ${cursor} disabled:opacity-50 transition-colors`}
      aria-label={`Status: ${STATUS_LABEL[currentStatus]}`}
    >
      <Icon className="w-5 h-5" strokeWidth={1.75} />
    </button>
  );
}
