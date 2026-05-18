import { DashboardCountsGrid } from "@/components/domain/DashboardCountsGrid";
import { DashboardMRRSection } from "@/components/domain/DashboardMRRSection";
import { DashboardPersonsSection } from "@/components/domain/DashboardPersonsSection";
import { DashboardVillainsSection } from "@/components/domain/DashboardVillainsSection";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdmin } from "@/lib/auth/server";
import {
  getDashboardSummary,
  getTopClientsByMRR,
  getTopVillainsByFrequency,
} from "@/lib/db/queries/dashboard";

export default async function Page() {
  await requireAdmin();

  const [summary, topClients, topVillains] = await Promise.all([
    getDashboardSummary(),
    getTopClientsByMRR(5),
    getTopVillainsByFrequency(5),
  ]);

  return (
    <>
      <PageHeader
        title="Painel"
        subtitle="Visão agregada: receita, saúde, capacidade e tração."
      />
      <div className="flex flex-col gap-8">
        <DashboardMRRSection
          mrrTotal={summary.mrrTotal}
          activeOperations={summary.activeOperations}
          topClients={topClients}
        />
        <DashboardCountsGrid
          activeOperations={summary.activeOperations}
          archivedOperations={summary.archivedOperations}
          frentesHealthy={summary.frentesHealthy}
          frentesStale={summary.frentesStale}
          openTasks={summary.openTasks}
        />
        <DashboardVillainsSection
          topVillains={topVillains}
          quickWinsLast30d={summary.quickWinsLast30d}
        />
        <DashboardPersonsSection
          internalPersons={summary.internalPersons}
          externalPersons={summary.externalPersons}
          openAllocations={summary.openAllocations}
        />
      </div>
    </>
  );
}
