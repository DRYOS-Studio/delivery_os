"use client";

import {
  BookOpen,
  Briefcase,
  Contact,
  Home,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/utils/cn";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  count?: number | undefined;
  exactMatch?: boolean;
};

type NavGroup = {
  label: string;
  items: readonly NavItem[];
};

export function SidebarNav({
  clientsCount,
  operationsCount,
  personsCount,
  hotCriticalCount,
  isAdmin = false,
}: {
  clientsCount?: number;
  operationsCount?: number;
  personsCount?: number;
  hotCriticalCount?: number;
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
        href: "/clients",
        label: "Clientes",
        icon: Users,
        count: clientsCount,
      },
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
      { href: "/catalog", label: "Catálogo", icon: BookOpen },
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
          {group.items.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : item.exactMatch
                  ? pathname === item.href
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm font-medium transition-colors",
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
          })}
        </div>
      ))}
    </nav>
  );
}
