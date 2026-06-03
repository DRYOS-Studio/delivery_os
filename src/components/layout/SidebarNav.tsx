"use client";

import {
  BookOpen,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Contact,
  Home,
  LayoutDashboard,
  ListChecks,
  Package,
  Settings,
  Skull,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType, type SVGProps } from "react";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/utils/cn";

type NavLeaf = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  count?: number | undefined;
  exactMatch?: boolean;
};

type NavParent = {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  matchPrefix: string;
  children: readonly NavLeaf[];
};

type NavItem = NavLeaf | NavParent;

type NavGroup = {
  label: string;
  items: readonly NavItem[];
};

function isParent(item: NavItem): item is NavParent {
  return "children" in item;
}

function isLeafActive(item: NavLeaf, pathname: string): boolean {
  if (item.href === "/") return pathname === "/";
  if (item.exactMatch) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function SidebarNav({
  clientsCount,
  operationsCount,
  personsCount,
  hotCriticalCount,
  myTasksCount,
  isAdmin = false,
}: {
  clientsCount?: number;
  operationsCount?: number;
  personsCount?: number;
  hotCriticalCount?: number;
  myTasksCount?: number | undefined;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const hotCritDisplay =
    hotCriticalCount && hotCriticalCount > 0
      ? hotCriticalCount >= 10
        ? "9+"
        : String(hotCriticalCount)
      : null;

  const workspaceGroup: NavGroup = {
    label: "Espaço de trabalho",
    items: [
      { href: "/", label: "Home", icon: Home },
      {
        href: "/tasks",
        label: "Tasks",
        icon: ListChecks,
        count: myTasksCount,
      },
      { href: "/clients", label: "Clientes", icon: Users, count: clientsCount },
      {
        href: "/operations",
        label: "Operações",
        icon: Briefcase,
        count: operationsCount,
      },
      {
        href: "/persons",
        label: "Pessoas",
        icon: Contact,
        count: personsCount,
      },
    ],
  };

  const adminGroup: NavGroup = {
    label: "Admin",
    items: [
      { href: "/admin/dashboard", label: "Painel", icon: LayoutDashboard },
      {
        label: "Catálogos",
        icon: BookOpen,
        matchPrefix: "/catalog",
        children: [
          { href: "/catalog", label: "Vilões", icon: Skull, exactMatch: true },
          { href: "/catalog/products", label: "Produtos", icon: Package },
          { href: "/catalog/quick-wins", label: "Quick Wins", icon: Trophy },
        ],
      },
      { href: "/admin", label: "Admin", icon: Settings, exactMatch: true },
    ],
  };

  const groups: readonly NavGroup[] = isAdmin
    ? [workspaceGroup, adminGroup]
    : [workspaceGroup];

  return (
    <nav className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="font-mono text-[10px] uppercase tracking-wide text-mute-soft px-3">
            {group.label}
          </p>
          {group.items.map((item) =>
            isParent(item) ? (
              <ParentItem
                key={item.label}
                item={item}
                pathname={pathname}
              />
            ) : (
              <LeafLink
                key={item.href}
                item={item}
                pathname={pathname}
                hotCritDisplay={hotCritDisplay}
              />
            ),
          )}
        </div>
      ))}
    </nav>
  );
}

function LeafLink({
  item,
  pathname,
  hotCritDisplay,
  indent = false,
}: {
  item: NavLeaf;
  pathname: string;
  hotCritDisplay?: string | null;
  indent?: boolean;
}) {
  const isActive = isLeafActive(item, pathname);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm font-medium transition-colors",
        indent && "pl-9",
        isActive
          ? "bg-oak-50 text-oak"
          : "text-mute hover:text-ink hover:bg-surface",
      )}
    >
      <Icon className="w-4 h-4" strokeWidth={1.75} />
      <span>{item.label}</span>
      {item.href === "/" && hotCritDisplay && (
        <Pill variant="critical" className="ml-auto">
          {hotCritDisplay}
        </Pill>
      )}
      {item.href !== "/" && item.count != null && (
        <Pill variant="neutral" className="ml-auto">
          {item.count}
        </Pill>
      )}
    </Link>
  );
}

function ParentItem({
  item,
  pathname,
}: {
  item: NavParent;
  pathname: string;
}) {
  const insideSection =
    pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`);
  const [manuallyOpen, setManuallyOpen] = useState<boolean | null>(null);
  const isOpen = manuallyOpen ?? insideSection;
  const Icon = item.icon;
  const Chevron = isOpen ? ChevronDown : ChevronRight;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setManuallyOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm font-medium transition-colors w-full text-left",
          insideSection
            ? "text-ink"
            : "text-mute hover:text-ink hover:bg-surface",
        )}
        aria-expanded={isOpen}
      >
        <Icon className="w-4 h-4" strokeWidth={1.75} />
        <span>{item.label}</span>
        <Chevron
          className="w-3.5 h-3.5 ml-auto text-mute-soft"
          strokeWidth={1.75}
        />
      </button>
      {isOpen &&
        item.children.map((child) => (
          <LeafLink key={child.href} item={child} pathname={pathname} indent />
        ))}
    </div>
  );
}
