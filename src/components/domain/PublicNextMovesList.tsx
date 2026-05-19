import type { NextMoveItem } from "@/lib/db/queries/public-report";

export function PublicNextMovesList({
  items,
}: {
  items: NextMoveItem[];
}): React.JSX.Element {
  if (items.length === 0) return <></>;

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h2
          className="font-display text-2xl font-semibold text-ink"
          style={{ letterSpacing: "-0.02em" }}
        >
          Próximos movimentos
        </h2>
        <span className="font-mono text-[11px] text-mute px-3 py-1 rounded-pill bg-surface">
          {items.length} {items.length === 1 ? "passo" : "passos"}
        </span>
      </div>

      <ol className="bg-card border border-line rounded-lg overflow-hidden">
        {items.map((item, idx) => (
          <li
            key={item.id}
            className={`grid items-center gap-4 px-6 py-5 ${
              idx !== 0 ? "border-t border-line" : ""
            }`}
            style={{ gridTemplateColumns: "36px 1fr auto" }}
          >
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center font-mono font-semibold text-[11px] bg-oak-50 text-oak"
            >
              {idx + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink leading-snug">
                {item.title}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-wide text-mute-soft mt-0.5">
                {item.kind === "task" ? "Tarefa" : "Reunião"}
              </p>
            </div>
            <span className="font-mono text-[11px] text-mute px-3 py-1 rounded-pill bg-surface">
              {item.etaLabel}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
