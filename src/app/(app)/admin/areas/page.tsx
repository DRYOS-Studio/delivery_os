import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileAreasManager } from "@/components/domain/ProfileAreasManager";
import { requireAdmin } from "@/lib/auth/server";
import { listProfilesWithAreas } from "@/lib/db/queries/profile-areas";

export default async function Page() {
  await requireAdmin();
  const profiles = await listProfilesWithAreas();

  return (
    <>
      <PageHeader
        title="Áreas"
        subtitle="Quem é de CS, Financeiro e Jurídico. Quem está numa área vê as tarefas daquela área em toda a carteira."
      />
      {profiles.length === 0 ? (
        <div className="bg-card border border-line rounded p-7 text-center">
          <p className="font-body text-sm text-mute">
            Nenhum usuário membro pra atribuir. Admins já enxergam todas as áreas.
          </p>
        </div>
      ) : (
        <ProfileAreasManager profiles={profiles} />
      )}
    </>
  );
}
