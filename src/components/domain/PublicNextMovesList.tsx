import type { NextMoveItem } from "@/lib/db/queries/public-report";

export function PublicNextMovesList({
  items,
}: {
  items: NextMoveItem[];
}): React.JSX.Element {
  if (items.length === 0) return <></>;

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-display text-lg text-ink font-semibold">
          Próximos movimentos
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-wide text-mute">
          {items.length} {items.length === 1 ? "passo" : "passos"}
        </span>
      </div>

      <ol className="bg-card border border-line rounded overflow-hidden">
        {items.map((item, idx) => (
          <li
            key={item.id}
            className={`grid grid-cols-[3rem_1fr_auto] gap-4 items-center px-4 py-3 ${
              idx !== items.length - 1 ? "border-b border-line" : ""
            }`}
          >
            <span className="font-display text-3xl text-mute-soft font-semibold leading-none">
              {idx + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm text-ink-soft truncate">{item.title}</p>
              <p className="font-mono text-[10px] uppercase tracking-wide text-mute-soft mt-0.5">
                {item.kind === "task" ? "Tarefa" : "Reunião"}
              </p>
            </div>
            <span className="font-mono text-xs text-ink-soft font-medium">
              {item.etaLabel}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
