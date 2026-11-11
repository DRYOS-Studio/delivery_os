import { AdminMcpTokensSection } from "@/components/domain/AdminMcpTokensSection";
import { AdminUsersSection } from "@/components/domain/AdminUsersSection";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdmin } from "@/lib/auth/server";
import {
  listOperationsForAdminInvite,
  listPersonsForAdminLink,
} from "@/lib/db/queries/admin-directory";
import {
  enrichMcpTokensWithProfiles,
  listAllMcpAgentTokensForAdmin,
} from "@/lib/db/queries/mcp-agent-tokens";
import { listProfiles } from "@/lib/db/queries/profiles";

export default async function Page() {
  const profile = await requireAdmin();
  const [profiles, operations, persons] = await Promise.all([
    listProfiles(),
    listOperationsForAdminInvite(),
    listPersonsForAdminLink(),
  ]);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

  let mcpTokens = enrichMcpTokensWithProfiles([], profiles);
  try {
    const rows = await listAllMcpAgentTokensForAdmin();
    mcpTokens = enrichMcpTokensWithProfiles(rows, profiles);
  } catch {
    /* migration não aplicada em dev */
  }

  return (
    <>
      <PageHeader
        title="Painel admin"
        subtitle="Gestão de usuários e métricas internas."
      />
      <AdminMcpTokensSection
        appUrl={appUrl}
        profiles={profiles}
        initialTokens={mcpTokens}
      />
      <AdminUsersSection
        profiles={profiles}
        currentUserId={profile.user.id}
        operations={operations}
        persons={persons}
      />
    </>
  );
}
