import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileAreasManager } from "@/components/domain/ProfileAreasManager";
import { requireAdmin } from "@/lib/auth/server";
import { listAreas } from "@/lib/db/queries/areas";
import { listProfilesWithAreas } from "@/lib/db/queries/profile-areas";

export default async function Page() {
  await requireAdmin();
  const [profiles, areas] = await Promise.all([
    listProfilesWithAreas(),
    listAreas(),
  ]);
  const allAreas = areas.map((a) => ({ id: a.id, name: a.name }));

  return (
    <>
      <PageHeader
        title="Áreas"
        subtitle="Quem é de cada área. Quem está numa área vê o painel dos clientes/operações concedidos àquela área."
      />
      {profiles.length === 0 ? (
        <div className="bg-card border border-line rounded p-7 text-center">
          <p className="font-body text-sm text-mute">
            Nenhum usuário membro pra atribuir. Admins já enxergam todas as áreas.
          </p>
        </div>
      ) : (
        <ProfileAreasManager profiles={profiles} allAreas={allAreas} />
      )}
    </>
  );
}
