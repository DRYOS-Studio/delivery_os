import { VillainProgressBar } from "@/components/domain/VillainProgressBar";
import { Card } from "@/components/ui/Card";
import { Pill, type PillVariant } from "@/components/ui/Pill";
import { resolveVillainIcon } from "@/lib/constants/villain-icons";
import type { OperationVillainListItem } from "@/lib/db/queries/operation-villains";
import {
  progressVariant,
  SEVERITY_LABEL,
  SEVERITY_VARIANT,
} from "@/lib/utils/severity";

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
}: {
  items: OperationVillainListItem[];
}): React.JSX.Element {
  if (items.length === 0) return <></>;

  return (
    <section className="mb-9">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-display text-lg text-ink font-semibold">
          Vilões em luta
        </h2>
        <Pill variant="neutral">{items.length}</Pill>
      </div>

      <ul className="space-y-3">
        {items.map((item) => {
          const Icon = resolveVillainIcon(item.villain.iconName);
          const villainVariant =
            (item.villain.pillVariant as PillVariant) ?? "neutral";
          return (
            <li key={item.id}>
              <Card>
                <div className="flex items-start gap-4">
                  <div
                    className={`flex-shrink-0 w-16 h-16 rounded flex items-center justify-center ${VARIANT_BG[villainVariant]}`}
                  >
                    <Icon className="w-8 h-8" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display text-lg font-semibold text-ink">
                        {item.villain.name}
                      </h3>
                      <Pill variant={SEVERITY_VARIANT[item.initialSeverity]}>
                        Severidade inicial:{" "}
                        {SEVERITY_LABEL[item.initialSeverity].toUpperCase()}
                      </Pill>
                    </div>
                    <p className="font-body text-sm italic text-mute">
                      “{item.villain.quote}”
                    </p>
                    <p className="text-sm text-ink-soft">
                      {item.villain.description}
                    </p>
                    <div className="flex items-center gap-3">
                      <Pill variant={progressVariant(item.progressPct)}>
                        {item.progressPct}% derrotado
                      </Pill>
                      <div className="flex-1">
                        <VillainProgressBar pct={item.progressPct} />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
