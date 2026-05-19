import { Trophy } from "lucide-react";
import { Pill } from "@/components/ui/Pill";
import { resolveVillainIcon } from "@/lib/constants/villain-icons";
import type { QuickWinListItem } from "@/lib/db/queries/quick-wins";
import { formatDateBR } from "@/lib/utils/date";

export function PublicAchievementsList({
  items,
  headerLabel = "Conquistas recentes",
  headerMeta,
  emptyStateText,
}: {
  items: QuickWinListItem[];
  headerLabel?: string;
  headerMeta?: string;
  emptyStateText?: string;
}): React.JSX.Element {
  if (items.length === 0) {
    if (!emptyStateText) return <></>;
    return (
      <section className="mb-12">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <h2
            className="font-display text-2xl font-semibold text-ink"
            style={{ letterSpacing: "-0.02em" }}
          >
            {headerLabel}
          </h2>
          {headerMeta && (
            <span className="font-mono text-[11px] text-mute px-3 py-1 rounded-pill bg-surface">
              {headerMeta}
            </span>
          )}
        </div>
        <p className="text-sm text-mute py-4 italic">{emptyStateText}</p>
      </section>
    );
  }

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h2
          className="font-display text-2xl font-semibold text-ink"
          style={{ letterSpacing: "-0.02em" }}
        >
          {headerLabel}
        </h2>
        {headerMeta ? (
          <span className="font-mono text-[11px] text-mute px-3 py-1 rounded-pill bg-surface">
            {headerMeta}
          </span>
        ) : (
          <Pill variant="neutral">{items.length}</Pill>
        )}
      </div>

      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        }}
      >
        {items.map((qw) => (
          <article
            key={qw.id}
            className="bg-card border border-line rounded-lg p-6 transition-all hover:border-sage hover:shadow-md"
          >
            <header className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded bg-sage-bg flex items-center justify-center text-sage-deep">
                <Trophy className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <span className="font-mono text-[11px] text-mute">
                {formatDateBR(qw.happenedAt)}
              </span>
            </header>
            <h3
              className="font-display text-lg font-semibold text-ink mb-2 leading-tight"
              style={{ letterSpacing: "-0.015em" }}
            >
              {qw.title}
            </h3>
            {qw.description && (
              <p className="text-[13px] text-ink-soft leading-relaxed mb-3 whitespace-pre-wrap">
                {qw.description}
              </p>
            )}
            {qw.impacts.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-3 border-t border-line">
                {qw.impacts.map((imp) => {
                  const Icon = resolveVillainIcon(imp.villain.iconName);
                  return (
                    <Pill key={imp.id} variant="sage">
                      <Icon className="w-3 h-3" strokeWidth={1.75} />
                      {imp.villain.name} +{imp.impactPct}%
                    </Pill>
                  );
                })}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
