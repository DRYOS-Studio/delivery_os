import { User } from "lucide-react";
import { Pill } from "@/components/ui/Pill";
import type { OperationMemberRow } from "@/lib/db/queries/operation-members";
import { RemoveOperationMemberButton } from "./RemoveOperationMemberButton";

export function OperationMembersList({
  items,
  operationId,
}: {
  items: OperationMemberRow[];
  operationId: string;
}): React.JSX.Element {
  return (
    <div className="bg-card border border-line rounded divide-y divide-line">
      {items.map((m) => (
        <div
          key={m.profileId}
          className="grid items-center gap-3 px-4 py-3 grid-cols-[2rem_1fr_auto]"
        >
          <div className="w-8 h-8 rounded-sm flex items-center justify-center bg-surface text-mute">
            <User className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex items-center gap-3 flex-wrap">
            <h3 className="font-display text-sm font-semibold text-ink truncate">
              {m.name ?? "Sem nome"}
            </h3>
            <Pill variant={m.role === "admin" ? "oak" : "neutral"}>
              {m.role}
            </Pill>
            <span className="font-mono text-[10px] text-mute uppercase tracking-wide">
              desde {new Date(m.createdAt).toLocaleDateString("pt-BR")}
            </span>
          </div>
          <RemoveOperationMemberButton
            operationId={operationId}
            profileId={m.profileId}
            name={m.name ?? "este membro"}
          />
        </div>
      ))}
    </div>
  );
}
