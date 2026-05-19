import { Zap } from "lucide-react";
import type { ReportHeroData } from "@/lib/db/queries/public-report";

function buildLede(data: ReportHeroData): string {
  const monthsLabel = data.monthIndex === 1 ? "1 mês" : `${data.monthIndex} meses`;
  const kPart =
    data.activeVillainsCount === 0
      ? "Esta operação ainda não tem vilões mapeados."
      : `a DRYOS conduziu uma jornada de luta contra ${data.activeVillainsCount} ${data.activeVillainsCount === 1 ? "dos 7 vilões" : "dos 7 vilões"} da ineficiência operacional.`;
  return `Em ${monthsLabel}, ${kPart} Este é o relatório de ${data.monthLabel}.`;
}

export function PublicReportHero({
  data,
}: {
  data: ReportHeroData;
}): React.JSX.Element {
  const headline = data.topVillain
    ? (
        <>
          O <span className="text-ink">{data.topVillain.name}</span> perdeu{" "}
          <em className="not-italic text-oak font-semibold">
            {data.topVillain.progressPct}%
          </em>{" "}
          de força na sua operação.
        </>
      )
    : (
        <>A jornada de transformação da sua operação acabou de começar.</>
      );

  const deltaLabel =
    data.qwCountDelta === null
      ? "—"
      : data.qwCountDelta === 0
        ? `0 vs ${data.prevMonthLabel}`
        : data.qwCountDelta > 0
          ? `+${data.qwCountDelta} vs ${data.prevMonthLabel}`
          : `${data.qwCountDelta} vs ${data.prevMonthLabel}`;

  return (
    <section className="mb-10 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-start">
      <div>
        <div className="inline-flex items-center gap-1.5 mb-3">
          <Zap className="w-3.5 h-3.5 text-oak" strokeWidth={1.75} />
          <span className="font-mono text-[10px] uppercase tracking-wider text-mute">
            Mês {data.monthIndex} de operação
          </span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink-soft leading-tight font-semibold mb-3">
          {headline}
        </h1>
        <p className="text-sm text-mute max-w-2xl leading-relaxed">
          {buildLede(data)}
        </p>
      </div>
      <aside className="bg-card border border-line rounded p-4 min-w-[180px]">
        <div className="font-mono text-[10px] uppercase tracking-wide text-mute mb-1">
          Quick wins · {data.monthLabel}
        </div>
        <div className="font-display text-4xl font-semibold text-ink leading-none">
          {data.qwCountCurrent}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-wide text-mute-soft mt-1">
          {deltaLabel}
        </div>
      </aside>
    </section>
  );
}
