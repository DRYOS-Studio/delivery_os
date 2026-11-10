"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CLIENT_HUB_TABS,
  type ClientHubTabKey,
} from "@/lib/utils/client-hub-tabs";
import { cn } from "@/lib/utils/cn";

function activeTabFromPathname(
  clientId: string,
  pathname: string,
): ClientHubTabKey {
  const base = `/clients/${clientId}`;
  if (pathname === base || pathname === `${base}/`) return "visao";
  for (const t of CLIENT_HUB_TABS) {
    if (t.key === "visao") continue;
    const href = t.href(clientId);
    if (pathname === href || pathname.startsWith(`${href}/`)) return t.key;
  }
  return "visao";
}

type Props = {
  clientId: string;
  isAdmin: boolean;
};

export function ClientHubNav({ clientId, isAdmin }: Props): React.JSX.Element {
  const pathname = usePathname();
  const active = activeTabFromPathname(clientId, pathname);
  const tabs = CLIENT_HUB_TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <nav className="sticky top-0 z-10 bg-bg border-b border-line mb-7 -mx-4 px-4 md:-mx-7 md:px-7">
      <div className="flex gap-1 overflow-x-auto -mb-px scrollbar-thin snap-x snap-mandatory md:snap-none">
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <Link
              key={t.key}
              href={t.href(clientId)}
              prefetch={false}
              className={cn(
                "relative snap-start shrink-0 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors",
                isActive
                  ? "border-oak text-ink"
                  : "border-transparent text-mute hover:text-ink",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
