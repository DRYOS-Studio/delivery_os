import { MetricCard } from "@/components/ui/MetricCard";
import type { DashboardSummary } from "@/lib/db/queries/dashboard";
import { formatMoneyBR } from "@/lib/utils/money";

type Props = {
  summary: DashboardSummary;
  isAdmin: boolean;
};

export function HomeKpiStrip({ summary, isAdmin }: Props) {
  return (
    <div
      className={`grid grid-cols-2 md:grid-cols-3 gap-3 ${
        isAdmin ? "xl:grid-cols-6" : "xl:grid-cols-4"
      }`}
    >
      <MetricCard label="Operações ativas" value={summary.activeOperations} />
      <MetricCard label="Frentes saudáveis" value={summary.frentesHealthy} />
      <MetricCard
        label="Frentes paradas"
        value={summary.frentesStale}
        {...(summary.frentesStale > 0 ? { variant: "warning" as const } : {})}
      />
      <MetricCard label="Tasks abertas" value={summary.openTasks} />
      {isAdmin && (
        <>
          <MetricCard label="MRR" value={formatMoneyBR(summary.mrrTotal)} />
          <MetricCard
            label="Margem mensal"
            value={formatMoneyBR(summary.monthlyMarginTotal)}
            {...(summary.monthlyMarginTotal < 0
              ? { variant: "critical" as const }
              : {})}
          />
        </>
      )}
    </div>
  );
}
