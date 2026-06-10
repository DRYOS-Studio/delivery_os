import { AreaCatalog } from "@/components/domain/AreaCatalog";
import { ProfileAreasManager } from "@/components/domain/ProfileAreasManager";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdmin } from "@/lib/auth/server";
import { listAreaOptions, listAreasForAdmin } from "@/lib/db/queries/areas";
import { listProfilesWithAreas } from "@/lib/db/queries/profile-areas";

export default async function Page() {
  await requireAdmin();
  const [areasAdmin, profiles, allAreas] = await Promise.all([
    listAreasForAdmin(),
    listProfilesWithAreas(),
    listAreaOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Áreas"
        subtitle="Crie áreas, defina quem é de cada uma e conceda acesso a clientes/operações. Quem é da área lê (read-only) o painel concedido."
      />

      <section className="space-y-3 mb-8">
        <h2 className="font-display text-lg font-semibold text-ink">
          Catálogo de áreas
        </h2>
        <AreaCatalog areas={areasAdmin} />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-ink">
          Membros por área
        </h2>
        {profiles.length === 0 ? (
          <div className="bg-card border border-line rounded p-7 text-center">
            <p className="font-body text-sm text-mute">
              Nenhum usuário membro pra atribuir. Admins já enxergam todas as
              áreas.
            </p>
          </div>
        ) : (
          <ProfileAreasManager profiles={profiles} allAreas={allAreas} />
        )}
      </section>
    </>
  );
}
