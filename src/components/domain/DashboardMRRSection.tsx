import { HorizontalBarChart } from "@/components/ui/HorizontalBarChart";
import { MetricCard } from "@/components/ui/MetricCard";
import type { ClientMRR } from "@/lib/db/queries/dashboard";
import { formatMoneyBR } from "@/lib/utils/money";


type Props = {
  mrrTotal: number;
  activeOperations: number;
  topClients: ClientMRR[];
};

export function DashboardMRRSection({
  mrrTotal,
  activeOperations,
  topClients,
}: Props) {
  const chartData = topClients.map((c) => ({ label: c.name, value: c.mrr }));

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold text-ink">Receita</h2>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">
        <MetricCard
          label="MRR total"
          value={formatMoneyBR(mrrTotal)}
          hint={`${activeOperations} ${activeOperations === 1 ? "operação ativa" : "operações ativas"}`}
          size="lg"
        />
        <div className="flex flex-col gap-2 p-5 bg-surface border border-line rounded-sm min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-wide text-mute">
            Top clientes por MRR
          </p>
          <HorizontalBarChart
            data={chartData}
            format="currency"
            emptyLabel="Sem operações ativas"
          />
        </div>
      </div>
    </section>
  );
}
