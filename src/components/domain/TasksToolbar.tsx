"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { InternalPersonItem } from "@/lib/db/queries/persons";
import type { TaskListFilter } from "@/lib/db/queries/tasks";
import { cn } from "@/lib/utils/cn";

const BASE_PATH = "/tasks";

const TABS: Array<{ key: TaskListFilter; label: string }> = [
  { key: "open", label: "Abertas" },
  { key: "done", label: "Concluídas" },
  { key: "all", label: "Todas" },
];

type Props = {
  filter: TaskListFilter;
  counts: { open: number; done: number; all: number };
  persons: InternalPersonItem[];
  /** "all" ou um personId — qual opção está selecionada no dropdown */
  selectedAssignee: string;
  /** Pessoa do usuário logado, pra canonicalizar a URL (default = sem param) */
  myPersonId: string | null;
};

export function TasksToolbar({
  filter,
  counts,
  persons,
  selectedAssignee,
  myPersonId,
}: Props): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  function pushWith(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const qs = params.toString();
    router.push(qs ? `${BASE_PATH}?${qs}` : BASE_PATH);
  }

  function goToTab(key: TaskListFilter) {
    pushWith((params) => {
      if (key === "open") params.delete("filter");
      else params.set("filter", key);
    });
  }

  function changeAssignee(value: string) {
    pushWith((params) => {
      // Selecionar a própria Pessoa = estado default → URL limpa sem param.
      if (value === myPersonId) params.delete("assignee");
      else params.set("assignee", value);
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div className="flex gap-2">
        {TABS.map((tab) => {
          const isActive = tab.key === filter;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => goToTab(tab.key)}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1 rounded text-xs font-mono uppercase tracking-wide transition-colors",
                isActive
                  ? "bg-ink text-bg"
                  : "bg-surface text-mute hover:text-ink",
              )}
            >
              {tab.label}
              <span className="text-[10px] opacity-70">{counts[tab.key]}</span>
            </button>
          );
        })}
      </div>

      <label className="flex items-center gap-2 text-xs font-mono uppercase tracking-wide text-mute">
        Responsável
        <select
          value={selectedAssignee}
          onChange={(e) => changeAssignee(e.target.value)}
          className="bg-card border border-line rounded px-2 py-1.5 text-sm font-body normal-case tracking-normal text-ink-soft focus:outline-none focus:border-line-strong"
        >
          <option value="all">Todos</option>
          {persons.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
