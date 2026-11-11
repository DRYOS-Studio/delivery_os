import { MetricCard } from "@/components/ui/MetricCard";
import type { ClientSummary } from "@/lib/db/queries/clients";
type Props = {
  summary: ClientSummary;
};

export function ClientSummarySection({ summary }: Props) {
  return (
    <section className="mb-7">
      <h2 className="font-display text-lg font-semibold text-ink mb-4">
        Resumo
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Operações ativas"
          value={summary.activeOperations}
          variant="sage"
        />
        <MetricCard
          label="Operações arquivadas"
          value={summary.archivedOperations}
        />
        <MetricCard
          label="Frentes ativas"
          value={summary.activeFrentes}
          variant="sage"
        />
      </div>
    </section>
  );
}
