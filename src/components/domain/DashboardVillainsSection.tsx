import { HorizontalBarChart } from "@/components/ui/HorizontalBarChart";
import { MetricCard } from "@/components/ui/MetricCard";
import type { VillainFrequency } from "@/lib/db/queries/dashboard";

type Props = {
  topVillains: VillainFrequency[];
  quickWinsLast30d: number;
};

export function DashboardVillainsSection({
  topVillains,
  quickWinsLast30d,
}: Props) {
  const chartData = topVillains.map((v) => ({
    label: v.name,
    value: v.count,
  }));

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold text-ink">
        Vilões & Quick Wins
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <div className="flex flex-col gap-2 p-5 bg-surface border border-line rounded-sm min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-wide text-mute">
            Top vilões por frequência
          </p>
          <HorizontalBarChart
            data={chartData}
            format="count_operations"
            emptyLabel="Catálogo ainda não aplicado a operações"
          />
        </div>
        <MetricCard
          label="Quick Wins"
          value={quickWinsLast30d}
          hint="Criados nos últimos 30 dias"
        />
      </div>
    </section>
  );
}
