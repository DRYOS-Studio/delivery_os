import { MetricCard } from "@/components/ui/MetricCard";

type Props = {
  activeOperations: number;
  archivedOperations: number;
  frentesHealthy: number;
  frentesStale: number;
  openTasks: number;
};

export function DashboardCountsGrid({
  activeOperations,
  archivedOperations,
  frentesHealthy,
  frentesStale,
  openTasks,
}: Props) {
  const staleVariant =
    frentesStale === 0 ? "sage" : frentesStale > 5 ? "critical" : "warning";
  const tasksVariant =
    openTasks === 0 ? "sage" : openTasks > 20 ? "warning" : "neutral";

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold text-ink">Status</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
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
        <MetricCard
          label="Tarefas abertas"
          value={openTasks}
          variant={tasksVariant}
          hint="Todo + doing + blocked"
        />
      </div>
    </section>
  );
}
