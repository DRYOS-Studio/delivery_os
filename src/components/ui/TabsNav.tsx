"use client";

import Link, { useLinkStatus } from "next/link";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/utils/cn";

// Feedback pontual de navegação pendente no tab clicado (sem loading.tsx:
// boundary ancestral flasharia skeleton full-page a cada troca de tab).
// Só aparece com prefetch={false} — rota prefetched pula o pending state.
function TabPendingIndicator() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block w-1.5 h-1.5 rounded-full bg-oak transition-opacity",
        pending ? "opacity-100 animate-pulse" : "opacity-0 w-0",
      )}
    />
  );
}

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
    <nav className="sticky top-0 z-10 bg-bg border-b border-line mb-7 -mx-4 px-4 md:-mx-7 md:px-7">
      <div className="flex gap-1 overflow-x-auto -mb-px scrollbar-thin snap-x snap-mandatory md:snap-none">
        {tabs.map((t) => {
          const isActive = t.key === activeTab;
          const href = `${basePath}?${searchParamName}=${t.key}`;
          const display =
            t.count !== undefined && t.count > 99 ? "99+" : t.count;
          return (
            <Link
              key={t.key}
              href={href}
              // prefetch full aqui disparava ~9 re-execuções da page em
              // background por visita E suprimia o pending do useLinkStatus.
              prefetch={false}
              scroll={false}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors snap-start",
                isActive
                  ? "border-ink text-ink"
                  : "border-transparent text-mute hover:text-ink",
              )}
            >
              <span>{t.label}</span>
              {display !== undefined && (
                <Pill variant={isActive ? "oak" : "neutral"}>{display}</Pill>
              )}
              <TabPendingIndicator />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
