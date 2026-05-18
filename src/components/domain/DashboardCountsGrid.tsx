import { MetricCard } from "@/components/ui/MetricCard";

type Props = {
  activeOperations: number;
  archivedOperations: number;
  frentesHealthy: number;
  frentesStale: number;
};

export function DashboardCountsGrid({
  activeOperations,
  archivedOperations,
  frentesHealthy,
  frentesStale,
}: Props) {
  const staleVariant =
    frentesStale === 0 ? "sage" : frentesStale > 5 ? "critical" : "warning";

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold text-ink">Status</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Operações ativas"
          value={activeOperations}
          variant="sage"
        />
        <MetricCard
          label="Operações arquivadas"
          value={archivedOperations}
        />
        <MetricCard
          label="Frentes saudáveis"
          value={frentesHealthy}
          variant="sage"
          hint="Status acionável atualizado nos últimos 14d"
        />
        <MetricCard
          label="Frentes stale"
          value={frentesStale}
          variant={staleVariant}
          hint="Sem status acionável ou sem update há 14d+"
        />
      </div>
    </section>
  );
}
