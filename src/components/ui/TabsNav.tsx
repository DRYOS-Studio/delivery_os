"use client";

import Link from "next/link";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/utils/cn";

export type TabDef<K extends string = string> = {
  key: K;
  label: string;
  count?: number;
};

type Props<K extends string> = {
  tabs: ReadonlyArray<TabDef<K>>;
  activeTab: K;
  basePath: string;
  searchParamName?: string;
};

export function TabsNav<K extends string>({
  tabs,
  activeTab,
  basePath,
  searchParamName = "tab",
}: Props<K>) {
  return (
    <nav className="sticky top-0 z-10 bg-bg border-b border-line mb-7 -mx-4 px-4">
      <div className="flex gap-1 overflow-x-auto -mb-px scrollbar-thin">
        {tabs.map((t) => {
          const isActive = t.key === activeTab;
          const href = `${basePath}?${searchParamName}=${t.key}`;
          const display =
            t.count !== undefined && t.count > 99 ? "99+" : t.count;
          return (
            <Link
              key={t.key}
              href={href}
              prefetch
              scroll={false}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                isActive
                  ? "border-ink text-ink"
                  : "border-transparent text-mute hover:text-ink",
              )}
            >
              <span>{t.label}</span>
              {display !== undefined && (
                <Pill variant={isActive ? "oak" : "neutral"}>{display}</Pill>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
