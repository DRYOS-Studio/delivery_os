import { AdminUsersSection } from "@/components/domain/AdminUsersSection";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdmin } from "@/lib/auth/server";
import { listProfiles } from "@/lib/db/queries/profiles";

export default async function Page() {
  const profile = await requireAdmin();
  const profiles = await listProfiles();

  return (
    <>
      <PageHeader
        title="Painel admin"
        subtitle="Gestão de usuários e métricas internas."
      />
      <AdminUsersSection
        profiles={profiles}
        currentUserId={profile.user.id}
      />
    </>
  );
}
