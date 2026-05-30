import Link from "next/link";
import { MyTaskListItem } from "@/components/domain/MyTaskListItem";
import type { MyTaskFilter, MyTaskRow } from "@/lib/db/queries/tasks";
import { cn } from "@/lib/utils/cn";

type Props = {
  tasks: MyTaskRow[];
  filter: MyTaskFilter;
  counts: { open: number; done: number; all: number };
};

const TABS: Array<{ key: MyTaskFilter; label: string }> = [
  { key: "open", label: "Abertas" },
  { key: "done", label: "Concluídas" },
  { key: "all", label: "Todas" },
];

const BASE_PATH = "/me/tasks";

export function MyTasksList({ tasks, filter, counts }: Props) {
  return (
    <section>
      <div className="flex gap-2 mb-4">
        {TABS.map((tab) => {
          const isActive = tab.key === filter;
          const href =
            tab.key === "open" ? BASE_PATH : `${BASE_PATH}?filter=${tab.key}`;
          return (
            <Link
              key={tab.key}
              href={href}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1 rounded text-xs font-mono uppercase tracking-wide transition-colors",
                isActive
                  ? "bg-ink text-bg"
                  : "bg-surface text-mute hover:text-ink",
              )}
            >
              {tab.label}
              <span className="text-[10px] opacity-70">{counts[tab.key]}</span>
            </Link>
          );
        })}
      </div>

      {tasks.length === 0 ? (
        <div className="bg-card border border-line rounded p-7 text-center">
          <p className="font-body text-sm text-mute">
            {filter === "open"
              ? "Nenhuma tarefa aberta atribuída a você. Respira."
              : filter === "done"
                ? "Você ainda não concluiu nenhuma tarefa."
                : "Nenhuma tarefa atribuída a você."}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-line rounded shadow-sm overflow-hidden">
          <ul>
            {tasks.map((t) => (
              <MyTaskListItem key={t.id} task={t} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
