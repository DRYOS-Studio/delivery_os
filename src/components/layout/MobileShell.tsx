"use client";

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

type Props = {
  sidebar: React.ReactNode;
  children: React.ReactNode;
};

export function MobileShell({ sidebar, children }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Fecha drawer ao navegar
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // ESC fecha
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Trava scroll do body enquanto aberto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="min-h-screen">
      {/* Top-bar mobile — visível só abaixo de md */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-surface border-b border-line">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-sm bg-ink text-bg flex items-center justify-center font-display font-semibold text-xs">
            D
          </div>
          <span className="font-display text-sm text-ink font-semibold">
            DRYOS Studio
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="text-ink hover:text-oak transition-colors p-2 -mr-2"
        >
          <Menu className="w-5 h-5" strokeWidth={1.75} />
        </button>
      </header>

      {/* Sidebar desktop — fixed, visível em md+ */}
      <div className="hidden md:block">
        <div className="fixed left-0 top-0 h-screen w-[220px] z-20">
          {sidebar}
        </div>
      </div>

      {/* Drawer mobile — só abaixo de md */}
      <div
        className={cn(
          "md:hidden fixed inset-0 z-40",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <div
          className={cn(
            "absolute inset-0 bg-ink/40 transition-opacity duration-200",
            open ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setOpen(false)}
        />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 w-[260px] bg-surface shadow-xl transition-transform duration-200",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="absolute top-3 right-3 z-10 text-mute hover:text-ink transition-colors p-2"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
          <div className="h-full">{sidebar}</div>
        </aside>
      </div>

      <main className="md:ml-[220px] max-w-[1280px] p-4 md:p-7">{children}</main>
    </div>
  );
}
