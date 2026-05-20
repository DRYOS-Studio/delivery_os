import { LayoutGrid, List } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export type CatalogView = "cards" | "list";

export function normalizeCatalogView(raw: string | undefined): CatalogView {
  return raw === "list" ? "list" : "cards";
}

export function CatalogViewToggle({
  basePath,
  current,
}: {
  basePath: string;
  current: CatalogView;
}): React.JSX.Element {
  return (
    <div className="inline-flex items-center gap-0.5 bg-surface rounded-pill p-0.5">
      <ToggleLink
        href={basePath}
        active={current === "cards"}
        label="Cards"
        icon={LayoutGrid}
      />
      <ToggleLink
        href={`${basePath}?view=list`}
        active={current === "list"}
        label="Lista"
        icon={List}
      />
    </div>
  );
}

function ToggleLink({
  href,
  active,
  label,
  icon: Icon,
}: {
  href: string;
  active: boolean;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      prefetch={false}
      scroll={false}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-pill font-mono text-[10px] uppercase tracking-wide transition-colors",
        active
          ? "bg-card text-ink shadow-sm"
          : "text-mute hover:text-ink",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="w-3 h-3" strokeWidth={1.75} />
      {label}
    </Link>
  );
}
