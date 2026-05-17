import { Trophy } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { resolveVillainIcon } from "@/lib/constants/villain-icons";
import type { QuickWinListItem } from "@/lib/db/queries/quick-wins";
import { relativeFromNow } from "@/lib/utils/date";
import { formatDateBR } from "@/lib/utils/date";

export function PublicAchievementsList({
  items,
}: {
  items: QuickWinListItem[];
}): React.JSX.Element {
  if (items.length === 0) return <></>;

  return (
    <section className="mb-9">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-display text-lg text-ink font-semibold">
          Conquistas recentes
        </h2>
        <Pill variant="neutral">{items.length}</Pill>
      </div>

      <ul className="space-y-3">
        {items.map((qw) => (
          <li key={qw.id}>
            <Card>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded bg-sage-bg flex items-center justify-center text-sage-deep">
                  <Trophy className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div>
                    <h3 className="font-display text-base font-semibold text-ink">
                      {qw.title}
                    </h3>
                    <p className="font-mono text-[11px] text-mute">
                      {formatDateBR(qw.happenedAt)} ·{" "}
                      {relativeFromNow(qw.happenedAt)}
                    </p>
                  </div>
                  {qw.description && (
                    <p className="text-sm text-ink-soft whitespace-pre-wrap">
                      {qw.description}
                    </p>
                  )}
                  {qw.impacts.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
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
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
