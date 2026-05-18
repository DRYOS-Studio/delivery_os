import { Plus } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { DeleteCostButton } from "@/components/domain/DeleteCostButton";
import type { OperationCostBreakdown } from "@/lib/db/queries/operation-costs";
import { formatDateBR } from "@/lib/utils/date";
import { getInitials } from "@/lib/utils/initials";
import { formatMoneyBR } from "@/lib/utils/money";

type Props = {
  operationId: string;
  breakdown: OperationCostBreakdown;
};

export function CostsTab({ operationId, breakdown }: Props) {
  const {
    fixedCost,
    adHocMonthly,
    adHocOnceTotal,
    adHocItems,
    allocations,
    allocationsTotal,
    totalMonthly,
  } = breakdown;

  return (
    <div className="space-y-9">
      <section className="bg-card border border-line rounded p-5">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-display text-lg text-ink font-semibold">
            Total mensal
          </h2>
          <p className="font-display text-3xl font-semibold text-ink">
            {formatMoneyBR(totalMonthly)}
          </p>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-wide text-mute">
          Fixo {formatMoneyBR(fixedCost)} · Ad-hoc {formatMoneyBR(adHocMonthly)}{" "}
          · Alocações {formatMoneyBR(allocationsTotal)}
        </p>
        {adHocOnceTotal > 0 && (
          <p className="font-mono text-[10px] uppercase tracking-wide text-mute mt-1">
            + Custos únicos no período: {formatMoneyBR(adHocOnceTotal)} (não
            entram no mensal)
          </p>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="font-display text-base text-ink font-semibold">
            Custo fixo mensal
          </h3>
          <Link
            href={`/operations/${operationId}/edit`}
            className="text-oak hover:underline text-sm font-medium"
          >
            Editar Operação →
          </Link>
        </div>
        <div className="bg-card border border-line rounded p-4">
          <p className="font-display text-2xl font-semibold text-ink">
            {formatMoneyBR(fixedCost)}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-wide text-mute mt-1">
            Editar via formulário da Operação (campo "Custo fixo mensal").
          </p>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-display text-base text-ink font-semibold">
            Custos ad-hoc
          </h3>
          <Pill variant="neutral">{adHocItems.length}</Pill>
          <div className="ml-auto">
            <Link href={`/operations/${operationId}/costs/new`}>
              <Button variant="sage" size="sm">
                <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                Adicionar custo
              </Button>
            </Link>
          </div>
        </div>
        {adHocItems.length === 0 ? (
          <div className="bg-card border border-line rounded p-7 text-center">
            <p className="font-body text-sm text-mute mb-4">
              Nenhum custo ad-hoc cadastrado.
            </p>
            <Link href={`/operations/${operationId}/costs/new`}>
              <Button variant="sage" size="sm">
                <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                Adicionar primeiro custo
              </Button>
            </Link>
          </div>
        ) : (
          <div className="bg-card border border-line rounded shadow-sm overflow-hidden">
            <ul>
              {adHocItems.map((c, idx) => (
                <li
                  key={c.id}
                  className={`grid grid-cols-12 gap-3 items-center px-4 py-3 ${
                    idx !== adHocItems.length - 1 ? "border-b border-line" : ""
                  }`}
                >
                  <div className="col-span-4 font-medium text-ink truncate">
                    <Link
                      href={`/operations/${operationId}/costs/${c.id}/edit`}
                      className="hover:underline"
                    >
                      {c.label}
                    </Link>
                  </div>
                  <div className="col-span-2 font-mono text-sm text-ink">
                    {formatMoneyBR(c.amount)}
                  </div>
                  <div className="col-span-2">
                    <Pill variant={c.recurrence === "mensal" ? "sage" : "oak"}>
                      {c.recurrence === "mensal" ? "Mensal" : "Única"}
                    </Pill>
                  </div>
                  <div className="col-span-3 font-mono text-[10px] text-mute">
                    {formatDateBR(c.startedAt)}
                    {c.endedAt ? ` → ${formatDateBR(c.endedAt)}` : ""}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <DeleteCostButton costId={c.id} label={c.label} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-display text-base text-ink font-semibold">
            Custos de Alocações
          </h3>
          <Pill variant="neutral">{allocations.length}</Pill>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-wide text-mute mb-3">
          Calculado: capacidade × taxa horária × 160h/mês. Edite a taxa em
          /persons.
        </p>
        {allocations.length === 0 ? (
          <div className="bg-card border border-line rounded p-7 text-center">
            <p className="font-body text-sm text-mute">
              Nenhuma alocação ativa nesta Operação.
            </p>
          </div>
        ) : (
          <div className="bg-card border border-line rounded shadow-sm overflow-hidden">
            <ul>
              {allocations.map((a, idx) => (
                <li
                  key={a.allocationId}
                  className={`grid grid-cols-12 gap-3 items-center px-4 py-3 ${
                    idx !== allocations.length - 1
                      ? "border-b border-line"
                      : ""
                  }`}
                >
                  <div className="col-span-4 flex items-center gap-2 min-w-0">
                    <Avatar
                      size="sm"
                      initials={getInitials(a.personName)}
                      color="oak"
                      className="cursor-default"
                    />
                    <Link
                      href={`/persons/${a.personId}`}
                      className="text-ink hover:underline truncate"
                    >
                      {a.personName}
                    </Link>
                  </div>
                  <div className="col-span-2 font-mono text-sm text-ink">
                    {a.effectiveWeeklyHours.toFixed(1)}h/sem
                    {a.weeklyHours === null && (
                      <span
                        className="text-mute-soft ml-1"
                        title={`Derivado de ${a.capacityPct}% × contratadas`}
                      >
                        ({a.capacityPct}%)
                      </span>
                    )}
                  </div>
                  <div className="col-span-3 font-mono text-sm text-ink">
                    {a.hourlyRate !== null ? (
                      `${formatMoneyBR(a.hourlyRate)}/h`
                    ) : (
                      <span className="text-mute-soft">— sem taxa —</span>
                    )}
                  </div>
                  <div className="col-span-3 font-mono text-sm text-ink text-right">
                    {a.hourlyRate !== null ? (
                      formatMoneyBR(a.monthlyCost)
                    ) : (
                      <span className="text-mute-soft">—</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
