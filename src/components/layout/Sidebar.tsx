import { LogOut } from "lucide-react";
import { signOutAction } from "@/lib/actions/auth";
import { getUser } from "@/lib/auth/server";
import { SidebarNav } from "@/components/layout/SidebarNav";

export async function Sidebar() {
  const user = await getUser();
  const email = user?.email ?? "anon";

  return (
    <aside className="fixed left-0 top-0 h-screen w-[220px] bg-surface border-r border-line p-5 flex flex-col">
      <div className="mb-7">
        <h1 className="font-display text-lg text-ink font-semibold leading-tight">
          DRYOS
        </h1>
        <span className="font-mono text-xs text-mute">— Delivery</span>
      </div>

      <SidebarNav />

      <div className="flex-1" />

      <div className="border-t border-line pt-3 mt-3 flex items-center gap-2">
        <span
          className="font-mono text-xs text-mute truncate flex-1"
          title={email}
        >
          {email}
        </span>
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-mute hover:text-ink transition-colors"
            aria-label="Sair"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </form>
      </div>
    </aside>
  );
}
