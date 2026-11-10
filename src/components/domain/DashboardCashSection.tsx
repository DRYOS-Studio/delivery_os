import type { ClientCashSummary } from "@/lib/db/queries/client-charges";
import { formatDateBR } from "@/lib/utils/date";
import { formatMoneyBR } from "@/lib/utils/money";

type Props = {
  summary: ClientCashSummary;
};

export function DashboardCashSection({ summary }: Props): React.JSX.Element {
  return (
    <section className="space-y-4" data-testid="dashboard-cash-section">
      <div>
        <h2 className="font-display text-lg text-ink font-semibold">
          Caixa (cobranças)
        </h2>
        <p className="text-sm text-mute">
          Competência {formatDateBR(summary.monthStart)} —{" "}
          {formatDateBR(summary.monthEnd)}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="A receber no mês" value={summary.toReceiveThisMonth} />
        <Metric label="Recebido no mês" value={summary.receivedThisMonth} />
        <Metric
          label="Em atraso"
          value={summary.overdueTotal}
          critical={summary.overdueTotal > 0}
        />
        <Metric
          label="MRR cadastrado"
          value={summary.registeredMrrThisMonth}
          hint={`Contratos vigentes (mensal): ${formatMoneyBR(summary.plannedReceivableThisMonth)}`}
        />
      </div>
      <div className="bg-card border border-line rounded p-4">
        <h3 className="text-sm font-semibold text-ink mb-2">
          Previsão de caixa (3 meses)
        </h3>
        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {summary.forecastNext3Months.map((f) => (
            <li key={f.month} className="font-mono text-sm">
              <span className="text-mute">{f.month}</span>
              <span className="float-right text-ink font-semibold">
                {formatMoneyBR(f.dueTotal)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {summary.overdueItems.length > 0 && (
        <div className="bg-card border border-line rounded p-4">
          <h3 className="text-sm font-semibold text-ink mb-2">Atrasadas</h3>
          <ul className="text-sm space-y-1">
            {summary.overdueItems.map((c) => (
              <li key={c.id} className="flex justify-between gap-2">
                <span className="text-mute truncate">
                  {c.chargeType} · venc. {formatDateBR(c.dueDate)}
                </span>
                <span className="font-mono text-ink shrink-0">
                  {formatMoneyBR(c.openAmount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  hint,
  critical,
}: {
  label: string;
  value: number;
  hint?: string;
  critical?: boolean;
}): React.JSX.Element {
  return (
    <div className="bg-card border border-line rounded p-4">
      <p className="font-mono text-[10px] uppercase text-mute">{label}</p>
      <p
        className={`font-display text-2xl font-semibold ${critical ? "text-critical" : "text-ink"}`}
      >
        {formatMoneyBR(value)}
      </p>
      {hint && <p className="text-[10px] text-mute mt-1">{hint}</p>}
    </div>
  );
}
