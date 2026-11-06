import { AdminUsersSection } from "@/components/domain/AdminUsersSection";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdmin } from "@/lib/auth/server";
import {
  listOperationsForAdminInvite,
  listPersonsForAdminLink,
} from "@/lib/db/queries/admin-directory";
import { listMcpAgentTokensForProfiles } from "@/lib/db/queries/mcp-agent-tokens";
import { listProfiles } from "@/lib/db/queries/profiles";

export default async function Page() {
  const profile = await requireAdmin();
  const [profiles, operations, persons] = await Promise.all([
    listProfiles(),
    listOperationsForAdminInvite(),
    listPersonsForAdminLink(),
  ]);

  let mcpTokensByProfile: Record<string, Awaited<ReturnType<typeof listMcpAgentTokensForProfiles>>> =
    {};
  try {
    const mcpRows = await listMcpAgentTokensForProfiles(profiles.map((p) => p.id));
    mcpTokensByProfile = {};
    for (const r of mcpRows) {
      const list = mcpTokensByProfile[r.profileId] ?? [];
      list.push(r);
      mcpTokensByProfile[r.profileId] = list;
    }
  } catch {
    /* migration não aplicada em dev */
  }

  return (
    <>
      <PageHeader
        title="Painel admin"
        subtitle="Gestão de usuários e métricas internas."
      />
      <AdminUsersSection
        profiles={profiles}
        currentUserId={profile.user.id}
        operations={operations}
        persons={persons}
        mcpTokensByProfile={mcpTokensByProfile}
      />
    </>
  );
}
