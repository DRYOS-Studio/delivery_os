import { LogOut } from "lucide-react";
import { signOutAction } from "@/lib/actions/auth";
import { getUser } from "@/lib/auth/server";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { Avatar } from "@/components/ui/Avatar";
import { countActiveClients } from "@/lib/db/queries/clients";
import { countHotCriticalFrentes } from "@/lib/db/queries/frentes";
import { countActiveOperations } from "@/lib/db/queries/operations";
import { countActivePersons } from "@/lib/db/queries/persons";
import { initialsFromEmail } from "@/lib/utils/initials";

export async function Sidebar() {
  const [
    user,
    clientsCount,
    operationsCount,
    personsCounts,
    hotCriticalCount,
  ] = await Promise.all([
    getUser(),
    countActiveClients(),
    countActiveOperations(),
    countActivePersons(),
    countHotCriticalFrentes(),
  ]);
  const email = user?.email ?? "anon";

  return (
    <aside className="fixed left-0 top-0 h-screen w-[220px] bg-surface border-r border-line p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-7">
        <div className="w-8 h-8 rounded-sm bg-ink text-bg flex items-center justify-center font-display font-semibold text-sm">
          D
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-display text-base text-ink font-semibold">
            DRYOS
          </span>
          <span className="font-mono text-[10px] text-mute uppercase tracking-wide">
            Delivery
          </span>
        </div>
      </div>

      <SidebarNav
        clientsCount={clientsCount}
        operationsCount={operationsCount}
        personsCount={personsCounts.total}
        hotCriticalCount={hotCriticalCount}
      />

      <div className="flex-1" />

      <div className="border-t border-line pt-3 mt-3 flex items-center gap-2">
        <Avatar size="sm" initials={initialsFromEmail(email)} color="oak" />
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
