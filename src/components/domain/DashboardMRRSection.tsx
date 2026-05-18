import { HorizontalBarChart } from "@/components/ui/HorizontalBarChart";
import { MetricCard } from "@/components/ui/MetricCard";
import type { ClientMRR } from "@/lib/db/queries/dashboard";
import { computeMargin, marginVariant } from "@/lib/utils/margin";
import { formatMoneyBR } from "@/lib/utils/money";


type Props = {
  mrrTotal: number;
  activeOperations: number;
  topClients: ClientMRR[];
  monthlyCostsTotal: number;
  monthlyMarginTotal: number;
};

export function DashboardMRRSection({
  mrrTotal,
  activeOperations,
  topClients,
  monthlyCostsTotal,
  monthlyMarginTotal,
}: Props) {
  const chartData = topClients.map((c) => ({ label: c.name, value: c.mrr }));
  const margin = computeMargin(mrrTotal, monthlyCostsTotal);
  const marginPct =
    margin.pct === null ? "—" : `${margin.pct.toFixed(0)}%`;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold text-ink">Receita</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="MRR total"
          value={formatMoneyBR(mrrTotal)}
          hint={`${activeOperations} ${activeOperations === 1 ? "operação ativa" : "operações ativas"}`}
          size="lg"
        />
        <MetricCard
          label="Custos mensais"
          value={formatMoneyBR(monthlyCostsTotal)}
          hint="Fixo + ad-hoc + alocações"
          size="lg"
        />
        <MetricCard
          label="Margem"
          value={formatMoneyBR(monthlyMarginTotal)}
          hint={`${marginPct} relativo ao MRR`}
          size="lg"
          variant={marginVariant(margin.level)}
        />
      </div>
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
    </section>
  );
}
