import { InviteUserForm } from "@/components/domain/InviteUserForm";
import { McpAgentTokensSection } from "@/components/domain/McpAgentTokensSection";
import { ProfileDisplayNameControl } from "@/components/domain/ProfileDisplayNameControl";
import { ProfilePersonLinkControl } from "@/components/domain/ProfilePersonLinkControl";
import { SetUserRoleButton } from "@/components/domain/SetUserRoleButton";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import type {
  OperationPickItem,
  PersonPickItem,
} from "@/lib/db/queries/admin-directory";
import type { McpAgentTokenRow } from "@/lib/db/queries/mcp-agent-tokens";
import type { ProfileListItem } from "@/lib/db/queries/profiles";
import { formatDateBR } from "@/lib/utils/date";
import { initialsFromEmail } from "@/lib/utils/initials";

export function AdminUsersSection({
  profiles,
  currentUserId,
  operations,
  persons,
  mcpTokensByProfile,
}: {
  profiles: ProfileListItem[];
  currentUserId: string;
  operations: OperationPickItem[];
  persons: PersonPickItem[];
  mcpTokensByProfile: Record<string, McpAgentTokenRow[]>;
}): React.JSX.Element {
  const adminCount = profiles.filter((p) => p.role === "admin").length;
  const memberCount = profiles.length - adminCount;

  return (
    <section className="mb-9">
      <InviteUserForm operations={operations} persons={persons} />
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
              className="bg-card border border-line rounded px-4 py-3 flex flex-col gap-3"
            >
              <div className="flex flex-wrap items-center gap-3">
                <Avatar
                  size="sm"
                  initials={initialsFromEmail(p.email)}
                  color={p.role === "admin" ? "oak" : "sage-deep"}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-body text-sm text-ink truncate">
                      {p.displayLabel ?? p.email ?? "—"}
                    </span>
                    <Pill variant={p.role === "admin" ? "sage" : "neutral"}>
                      {p.role === "admin" ? "Admin" : "Member"}
                    </Pill>
                  </div>
                  <p className="text-xs text-mute mt-0.5 truncate">
                    {p.email ?? "—"}
                  </p>
                  {p.personName && (
                    <p className="text-[10px] text-sage-deep font-mono mt-0.5">
                      Pessoa: {p.personName}
                    </p>
                  )}
                  <p className="font-mono text-[10px] text-mute-soft mt-0.5">
                    Desde {formatDateBR(p.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 ml-auto">
                  <ProfileDisplayNameControl
                    profileId={p.id}
                    initialName={p.name}
                    resolvedLabel={p.displayLabel}
                    email={p.email}
                  />
                  <ProfilePersonLinkControl
                    profileId={p.id}
                    persons={persons}
                    currentPersonId={p.personId}
                  />
                  <SetUserRoleButton
                    targetUserId={p.id}
                    targetEmail={p.email}
                    currentRole={p.role}
                    isSelf={p.id === currentUserId}
                  />
                </div>
              </div>
              <McpAgentTokensSection
                profileId={p.id}
                profileEmail={p.email}
                initialTokens={mcpTokensByProfile[p.id] ?? []}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
