export function PublicReportBanner({
  clientName,
  periodLabel,
}: {
  clientName: string;
  periodLabel: string;
}): React.JSX.Element {
  return (
    <header className="mb-6 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 border-b border-line bg-card flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded bg-oak text-bg font-display font-semibold flex items-center justify-center text-sm">
          D
        </div>
        <span className="font-display text-base font-semibold text-ink">
          DRYOS
        </span>
      </div>
      <span className="font-mono text-[10px] uppercase tracking-wider text-mute">
        Relatório de operação · <strong className="font-semibold text-ink-soft">{clientName}</strong> · {periodLabel}
      </span>
    </header>
  );
}
