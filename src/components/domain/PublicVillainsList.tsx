import { Pill, type PillVariant } from "@/components/ui/Pill";
import { resolveVillainIcon } from "@/lib/constants/villain-icons";
import type { OperationVillainListItem } from "@/lib/db/queries/operation-villains";
import { SEVERITY_LABEL, SEVERITY_VARIANT } from "@/lib/utils/severity";

const VARIANT_BG: Record<PillVariant, string> = {
  neutral: "bg-surface text-mute",
  oak: "bg-oak-50 text-oak",
  sage: "bg-sage-bg text-sage-deep",
  ok: "bg-ok-bg text-ok",
  warning: "bg-warning-bg text-warning",
  critical: "bg-critical-bg text-critical",
};

export function PublicVillainsList({
  items,
  narrativesByVillainId,
  totalVillains = 7,
}: {
  items: OperationVillainListItem[];
  narrativesByVillainId?: Record<string, string>;
  totalVillains?: number;
}): React.JSX.Element {
  if (items.length === 0) return <></>;

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h2
          className="font-display text-2xl font-semibold text-ink"
          style={{ letterSpacing: "-0.02em" }}
        >
          Vilões em luta
        </h2>
        <span
          className="font-mono text-[11px] text-mute px-3 py-1 rounded-pill bg-surface"
        >
          {items.length} / {totalVillains}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {items.map((item) => {
          const Icon = resolveVillainIcon(item.villain.iconName);
          const villainVariant =
            (item.villain.pillVariant as PillVariant) ?? "neutral";
          const narrative =
            narrativesByVillainId?.[item.villainId] ?? item.villain.description;
          return (
            <article
              key={item.id}
              className="bg-card border border-line rounded-lg p-5 sm:p-7 grid items-center gap-5 sm:gap-6 transition-shadow hover:shadow-md grid-cols-1 sm:[grid-template-columns:96px_1fr] lg:[grid-template-columns:120px_1fr_140px]"
            >
              <div
                className={`w-20 h-20 sm:w-24 sm:h-24 lg:w-[120px] lg:h-[120px] rounded flex items-center justify-center ${VARIANT_BG[villainVariant]}`}
              >
                <Icon
                  className="w-12 h-12 sm:w-14 sm:h-14"
                  strokeWidth={1.5}
                />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h3
                    className="font-display text-xl sm:text-2xl font-bold text-ink"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {item.villain.name}
                  </h3>
                  <Pill variant={SEVERITY_VARIANT[item.initialSeverity]}>
                    Severidade inicial:{" "}
                    {SEVERITY_LABEL[item.initialSeverity].toUpperCase()}
                  </Pill>
                </div>
                <p
                  className="text-sm leading-relaxed text-ink-soft whitespace-pre-wrap mb-4"
                  style={{ maxWidth: "55ch" }}
                >
                  {narrative}
                </p>
                <div className="h-1.5 rounded-pill overflow-hidden bg-surface">
                  <div
                    className="h-full rounded-pill transition-all"
                    style={{
                      width: `${item.progressPct}%`,
                      background:
                        "linear-gradient(90deg, #1F3A2A 0%, #93B596 100%)",
                    }}
                  />
                </div>
              </div>

              <div className="flex sm:flex-col items-center justify-center text-center bg-surface rounded p-4 sm:p-5 gap-3 sm:gap-0 col-span-full lg:col-span-1">
                <div
                  className="font-display font-bold leading-none sm:mb-1.5 text-[#5C8866]"
                  style={{
                    fontSize: "2.5rem",
                    letterSpacing: "-0.035em",
                  }}
                >
                  {item.progressPct}%
                </div>
                <div className="font-mono text-[10px] uppercase tracking-wide text-mute">
                  derrotado
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
