import { MetricCard } from "@/components/ui/MetricCard";
import type { ClientSummary } from "@/lib/db/queries/clients";
import { formatMoneyBR } from "@/lib/utils/money";

type Props = {
  summary: ClientSummary;
  isAdmin: boolean;
};

export function ClientSummarySection({ summary, isAdmin }: Props) {
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
        {isAdmin && (
          <MetricCard
            label="MRR total"
            value={formatMoneyBR(summary.mrrTotal)}
            hint="Operações ativas"
          />
        )}
      </div>
    </section>
  );
}
