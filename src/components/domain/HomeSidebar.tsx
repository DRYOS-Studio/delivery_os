import { HorizontalBarChart } from "@/components/ui/HorizontalBarChart";
import { MetricCard } from "@/components/ui/MetricCard";
import type { VillainFrequency } from "@/lib/db/queries/dashboard";

type Props = {
  isAdmin: boolean;
  topVillains: VillainFrequency[];
  quickWinsLast30d: number;
};

export function HomeSidebar({ isAdmin, topVillains, quickWinsLast30d }: Props) {
  const chartData = topVillains.map((v) => ({ label: v.name, value: v.count }));

  return (
    <div className="flex flex-col gap-6 xl:sticky xl:top-6">
      <div className="flex flex-col gap-2 p-5 bg-surface border border-line rounded-sm min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-wide text-mute">
          {isAdmin ? "Vilões da carteira" : "Vilões nas suas Operações"}
        </p>
        <HorizontalBarChart
          data={chartData}
          format="count_operations"
          height={200}
          emptyLabel="Nenhum vilão detectado ainda"
        />
      </div>
      <MetricCard
        label="Quick Wins"
        value={quickWinsLast30d}
        hint="Criados nos últimos 30 dias"
      />
    </div>
  );
}
