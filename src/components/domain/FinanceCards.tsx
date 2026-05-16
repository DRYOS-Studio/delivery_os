import { Calendar, DollarSign, Repeat } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Sparkline } from "@/components/domain/Sparkline";
import type { OperationDetail } from "@/lib/db/queries/operations";
import { formatDateBR } from "@/lib/utils/date";
import { mockMrrHistory } from "@/lib/utils/mock";
import { formatMoneyBR } from "@/lib/utils/money";

const RECURRENCE_LABEL: Record<
  NonNullable<OperationDetail["recurrence"]>,
  string
> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  anual: "Anual",
  unica: "Única",
};

export function FinanceCards({ op }: { op: OperationDetail }) {
  const hasMrr =
    op.monthlyRecurringRevenue !== null &&
    op.monthlyRecurringRevenue !== undefined;
  const sparkData = hasMrr
    ? mockMrrHistory(op.monthlyRecurringRevenue ?? 0, op.id)
    : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-9">
      <Card>
        <div className="flex items-center gap-2 mb-3 text-mute">
          <DollarSign className="w-4 h-4" strokeWidth={1.75} />
          <span className="font-mono text-[10px] uppercase tracking-wide">
            MRR
          </span>
        </div>
        <h3 className="font-display text-2xl font-semibold text-ink">
          {formatMoneyBR(op.monthlyRecurringRevenue)}
        </h3>
        {sparkData && (
          <div className="mt-3 -mx-1">
            <Sparkline data={sparkData} />
          </div>
        )}
        <p className="font-mono text-[10px] text-mute-soft mt-2">
          {hasMrr ? "últimos 6 meses · mock" : "não recorrente"}
        </p>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-3 text-mute">
          <Repeat className="w-4 h-4" strokeWidth={1.75} />
          <span className="font-mono text-[10px] uppercase tracking-wide">
            Recorrência
          </span>
        </div>
        <h3 className="font-display text-2xl font-semibold text-ink">
          {op.recurrence ? RECURRENCE_LABEL[op.recurrence] : "—"}
        </h3>
        <p className="font-mono text-[10px] text-mute-soft mt-2">
          ciclo de faturamento
        </p>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-3 text-mute">
          <Calendar className="w-4 h-4" strokeWidth={1.75} />
          <span className="font-mono text-[10px] uppercase tracking-wide">
            Contrato
          </span>
        </div>
        <h3 className="font-display text-base font-semibold text-ink">
          {formatDateBR(op.startDate)} → {formatDateBR(op.endDate)}
        </h3>
        <p className="font-mono text-[10px] text-mute-soft mt-2">
          início · fim
        </p>
      </Card>
    </div>
  );
}
