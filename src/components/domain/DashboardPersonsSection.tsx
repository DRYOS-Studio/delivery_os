import { MetricCard } from "@/components/ui/MetricCard";

type Props = {
  internalPersons: number;
  externalPersons: number;
  openAllocations: number;
};

export function DashboardPersonsSection({
  internalPersons,
  externalPersons,
  openAllocations,
}: Props) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold text-ink">
        Time & Alocações
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MetricCard label="Pessoas internas" value={internalPersons} />
        <MetricCard label="Pessoas externas" value={externalPersons} />
        <MetricCard
          label="Alocações abertas"
          value={openAllocations}
          variant="sage"
          hint="Sem data de fim"
        />
      </div>
    </section>
  );
}
