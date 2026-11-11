import Link from "next/link";
import { MetricCard } from "@/components/ui/MetricCard";
import { Pill } from "@/components/ui/Pill";
import type { ClientFinancialSummary } from "@/lib/db/queries/client-financial-summary";
import { formatTenureLabel } from "@/lib/utils/client-financial-helpers";
import { formatDateBR } from "@/lib/utils/date";
import { formatMoneyBR } from "@/lib/utils/money";
import { formatMarginPct, marginVariant } from "@/lib/utils/margin";

type Props = {
  clientId: string;
  financial: ClientFinancialSummary;
  compact?: boolean;
};

export function ClientFinancialOverview({
  clientId,
  financial,
  compact = false,
}: Props): React.JSX.Element {
  if (compact) {
    return <ClientFinancialCompact financial={financial} />;
  }

  const tenureLabel = formatTenureLabel(financial.tenureStartDate);

  return (
    <section className="mb-7" data-testid="client-financial-overview">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h2 className="font-display text-lg font-semibold text-ink">
          Visão financeira
        </h2>
        <p className="font-mono text-[10px] uppercase tracking-wide text-mute">
          {financial.activeOperationsCount}{" "}
          {financial.activeOperationsCount === 1
            ? "operação ativa"
            : "operações ativas"}{" "}
          · custos via mesma regra da aba Custos · LTV = cobranças pagas
        </p>
      </div>

      {financial.contractMrrMismatch && (
        <div className="mb-4 bg-warning-bg border border-warning/40 rounded-lg px-4 py-3 text-sm text-ink-soft">
          <p className="font-medium text-ink">
            Contrato e MRR das operações não batem
          </p>
          <p className="mt-1 text-mute">
            Soma dos contratos vigentes:{" "}
            {formatMoneyBR(financial.contractMonthlyTotal)} · MRR nas operações:{" "}
            {formatMoneyBR(financial.mrrTotal)}
            {financial.contractMrrDelta !== null && (
              <>
                {" "}
                (diferença {formatMoneyBR(financial.contractMrrDelta)})
              </>
            )}
            .{" "}
            <Link
              href={`/clients/${clientId}/contratos`}
              className="text-oak hover:underline"
            >
              Ver contratos
            </Link>
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          label="MRR total"
          value={formatMoneyBR(financial.mrrTotal)}
          variant="sage"
          hint="Operações ativas"
        />
        <MetricCard
          label="Custo mensal"
          value={formatMoneyBR(financial.monthlyCostTotal)}
          hint="Custos + alocações + impostos"
        />
        <MetricCard
          label="Margem"
          value={formatMoneyBR(financial.margin.value)}
          hint={formatMarginPct(financial.margin.pct)}
          variant={
            financial.margin.level === "positive"
              ? "sage"
              : financial.margin.level === "low"
                ? "warning"
                : "critical"
          }
        />
        <MetricCard
          label="Margem %"
          value={
            financial.margin.pct !== null
              ? `${financial.margin.pct.toLocaleString("pt-BR", {
                  maximumFractionDigits: 1,
                })}%`
              : "—"
          }
        />
        <MetricCard
          label="CAC"
          value={formatMoneyBR(financial.cacTotal)}
          hint="Custos de aquisição (aba CAC)"
        />
        <MetricCard
          label="Tempo de casa"
          value={tenureLabel ?? "—"}
          hint={
            financial.tenureStartDate
              ? `Desde ${formatDateBR(financial.tenureStartDate)}`
              : "Sem data de início"
          }
        />
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <MetricCard
          label="LTV recebido"
          value={formatMoneyBR(financial.ltvReceived)}
          variant="sage"
          hint="Soma de pagamentos em cobranças (mensalidade, implantação, avulsas)"
        />
        <MetricCard
          label="LTV / CAC"
          value={
            financial.ltvCacRatio !== null
              ? `${financial.ltvCacRatio.toLocaleString("pt-BR", {
                  maximumFractionDigits: 2,
                })}×`
              : "—"
          }
          hint={
            financial.cacTotal > 0
              ? `CAC ${formatMoneyBR(financial.cacTotal)}`
              : "Sem CAC cadastrado"
          }
        />
        <MetricCard
          label="A receber (em aberto)"
          value={formatMoneyBR(financial.receivablePending)}
          hint="Previstas/emitidas/atrasadas — não entra no LTV"
        />
        <div className="flex flex-col gap-1 p-4 md:p-5 bg-surface border border-line rounded-sm min-w-0 justify-center">
          <p className="font-mono text-[10px] uppercase tracking-wide text-mute">
            Detalhe
          </p>
          <Link
            href={`/clients/${clientId}/cobrancas`}
            className="text-oak hover:underline text-sm font-medium"
          >
            Ver cobranças →
          </Link>
        </div>
      </div>
    </section>
  );
}

export function ClientFinancialCompact({
  financial,
}: {
  financial: ClientFinancialSummary;
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-mute">
      <span>MRR {formatMoneyBR(financial.mrrTotal)}</span>
      <span aria-hidden>·</span>
      <span>Custo {formatMoneyBR(financial.monthlyCostTotal)}</span>
      <span aria-hidden>·</span>
      <span>LTV {formatMoneyBR(financial.ltvReceived)}</span>
      <span aria-hidden>·</span>
      <Pill variant={marginVariant(financial.margin.level)}>
        Margem {formatMarginPct(financial.margin.pct)}
      </Pill>
      {financial.contractMrrMismatch && (
        <span title="Contrato vigente ≠ soma MRR">
          <Pill variant="warning">Contrato ≠ MRR</Pill>
        </span>
      )}
    </div>
  );
}
