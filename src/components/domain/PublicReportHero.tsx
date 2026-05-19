import { Zap } from "lucide-react";
import type { ReportHeroData } from "@/lib/db/queries/public-report";

function buildLede(data: ReportHeroData): string {
  const monthsLabel = data.monthIndex === 1 ? "1 mês" : `${data.monthIndex} meses`;
  const kPart =
    data.activeVillainsCount === 0
      ? "Esta operação ainda não tem vilões mapeados."
      : `a DRYOS conduziu uma jornada de luta contra ${data.activeVillainsCount} dos 7 vilões da ineficiência operacional.`;
  return `Em ${monthsLabel}, ${kPart} Este é o relatório de ${data.monthLabel}.`;
}

export function PublicReportHero({
  data,
}: {
  data: ReportHeroData;
}): React.JSX.Element {
  const headline = data.topVillain ? (
    <>
      O <span className="text-bg">{data.topVillain.name}</span> perdeu{" "}
      <em className="not-italic text-sage font-semibold">
        {data.topVillain.progressPct}%
      </em>{" "}
      de força na sua operação.
    </>
  ) : (
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
    <section
      className="relative rounded-lg overflow-hidden mb-10 px-8 py-12 sm:px-12 sm:py-14 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-center"
      style={{
        background: "linear-gradient(135deg, #1F3A2A 0%, #2a4d39 100%)",
      }}
    >
      <div
        className="absolute pointer-events-none"
        style={{
          top: "-30%",
          right: "-10%",
          width: "50%",
          height: "160%",
          background:
            "radial-gradient(circle, rgba(147, 181, 150, 0.25) 0%, transparent 60%)",
        }}
      />
      <div className="relative z-10">
        <span
          className="inline-flex items-center gap-1.5 mb-5 px-3 py-1 rounded-pill font-mono text-[10px] uppercase tracking-wider"
          style={{
            background: "rgba(147, 181, 150, 0.2)",
            color: "#93B596",
          }}
        >
          <Zap className="w-3.5 h-3.5" strokeWidth={1.75} />
          Mês {data.monthIndex} de operação
        </span>
        <h1
          className="font-display font-semibold leading-[1.05] text-bg mb-4"
          style={{
            fontSize: "clamp(1.875rem, 4vw, 2.5rem)",
            letterSpacing: "-0.035em",
          }}
        >
          {headline}
        </h1>
        <p
          className="font-body text-[0.95rem] leading-relaxed"
          style={{
            color: "rgba(250, 250, 248, 0.85)",
            maxWidth: "45ch",
          }}
        >
          {buildLede(data)}
        </p>
      </div>
      <aside
        className="relative z-10 rounded-lg px-7 py-6 text-center min-w-[180px]"
        style={{
          background: "rgba(250, 250, 248, 0.08)",
          border: "1px solid rgba(250, 250, 248, 0.15)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div
          className="font-mono text-[10px] uppercase tracking-wide mb-2"
          style={{ color: "rgba(250, 250, 248, 0.7)" }}
        >
          Quick wins · {data.monthLabel}
        </div>
        <div
          className="font-display font-bold leading-none mb-1.5"
          style={{
            fontSize: "3rem",
            letterSpacing: "-0.035em",
            color: "#93B596",
          }}
        >
          {data.qwCountCurrent}
        </div>
        <div
          className="text-[11px]"
          style={{ color: "rgba(250, 250, 248, 0.7)" }}
        >
          {deltaLabel}
        </div>
      </aside>
    </section>
  );
}
