"use client";

import { Home, LayoutDashboard, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/utils/cn";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const ITEMS: readonly NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/catalog", label: "Catálogo", icon: Settings },
  { href: "/admin", label: "Painel", icon: LayoutDashboard },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {ITEMS.map((item) => {
        const isActive =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
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
          </Link>
        );
      })}
    </nav>
  );
}
