import { SetUserRoleButton } from "@/components/domain/SetUserRoleButton";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import type { ProfileListItem } from "@/lib/db/queries/profiles";
import { formatDateBR } from "@/lib/utils/date";
import { initialsFromEmail } from "@/lib/utils/initials";

export function AdminUsersSection({
  profiles,
  currentUserId,
}: {
  profiles: ProfileListItem[];
  currentUserId: string;
}): React.JSX.Element {
  const adminCount = profiles.filter((p) => p.role === "admin").length;
  const memberCount = profiles.length - adminCount;

  return (
    <section className="mb-9">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-display text-lg text-ink font-semibold">
          Usuários
        </h2>
        <Pill variant="neutral">{profiles.length}</Pill>
        <Pill variant="sage">{adminCount} admin</Pill>
        <Pill variant="neutral">{memberCount} member</Pill>
      </div>

      {profiles.length === 0 ? (
        <Card>
          <p className="text-sm text-mute text-center py-2">
            Nenhum usuário registrado ainda.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {profiles.map((p) => (
            <li
              key={p.id}
              className="bg-card border border-line rounded px-4 py-3 flex items-center gap-3"
            >
              <Avatar
                size="sm"
                initials={initialsFromEmail(p.email)}
                color={p.role === "admin" ? "oak" : "sage-deep"}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-body text-sm text-ink truncate">
                    {p.email ?? "—"}
                  </span>
                  <Pill variant={p.role === "admin" ? "sage" : "neutral"}>
                    {p.role === "admin" ? "Admin" : "Member"}
                  </Pill>
                </div>
                {p.name && (
                  <p className="text-xs text-mute mt-0.5">{p.name}</p>
                )}
                <p className="font-mono text-[10px] text-mute-soft mt-0.5">
                  Desde {formatDateBR(p.createdAt)}
                </p>
              </div>
              <SetUserRoleButton
                targetUserId={p.id}
                targetEmail={p.email}
                currentRole={p.role}
                isSelf={p.id === currentUserId}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
