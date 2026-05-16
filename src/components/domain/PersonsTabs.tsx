"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/utils/cn";

type Tab = {
  key: "internal" | "external" | "all";
  label: string;
  count: number;
};

export function PersonsTabs({
  counts,
  activeKind,
}: {
  counts: { internal: number; external: number; total: number };
  activeKind: "internal" | "external" | "all";
}): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabs: readonly Tab[] = [
    { key: "internal", label: "Internas", count: counts.internal },
    { key: "external", label: "Externas", count: counts.external },
    { key: "all", label: "Todas", count: counts.total },
  ];

  function goTo(key: Tab["key"]) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "all") {
      params.delete("kind");
    } else {
      params.set("kind", key);
    }
    const qs = params.toString();
    router.push(qs ? `/persons?${qs}` : "/persons");
  }

  return (
    <div className="flex gap-2 mb-5">
      {tabs.map((tab) => {
        const active = tab.key === activeKind;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => goTo(tab.key)}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-pill text-sm font-medium transition-colors",
              active
                ? "bg-card text-ink border border-line-strong"
                : "bg-transparent text-mute hover:text-ink",
            )}
          >
            <span>{tab.label}</span>
            <Pill variant="neutral">{tab.count}</Pill>
          </button>
        );
      })}
    </div>
  );
}
