import Link from "next/link";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/utils/cn";
import type { StatusFilter } from "@/lib/utils/status-filter";

type Counts = {
  em_construcao: number;
  em_operacao: number;
  janela_critica: number;
  todas: number;
};

type Props = {
  counts: Counts;
  active: StatusFilter;
};

const TABS: ReadonlyArray<{ key: keyof Counts; label: string }> = [
  { key: "todas", label: "Todas" },
  { key: "em_operacao", label: "Em operação" },
  { key: "em_construcao", label: "Em construção" },
  { key: "janela_critica", label: "Janela crítica" },
];

export function HomeStatusTabs({ counts, active }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        const href = tab.key === "todas" ? "/" : `/?status=${tab.key}`;
        return (
          <Link
            key={tab.key}
            href={href}
            scroll={false}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-pill text-sm font-medium transition-colors",
              isActive
                ? "bg-card text-ink border border-line-strong"
                : "bg-transparent text-mute hover:text-ink",
            )}
          >
            <span>{tab.label}</span>
            <Pill variant="neutral">{counts[tab.key]}</Pill>
          </Link>
        );
      })}
    </div>
  );
}
