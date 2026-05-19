export function PublicReportBanner({
  clientName,
  periodLabel,
}: {
  clientName: string;
  periodLabel: string;
}): React.JSX.Element {
  return (
    <header className="mb-6 -mx-6 px-6 py-4 border-b border-line bg-card flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded bg-oak text-bg font-display font-semibold flex items-center justify-center text-sm">
          D
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-display text-base font-semibold text-ink">
            DRYOS
          </span>
          <span className="font-mono text-[10px] text-mute uppercase tracking-wide">
            Studio
          </span>
        </div>
      </div>
      <span className="font-mono text-[10px] uppercase tracking-wider text-mute ml-auto">
        Relatório de operação · <strong className="font-semibold text-ink-soft">{clientName}</strong> · {periodLabel}
      </span>
    </header>
  );
}
