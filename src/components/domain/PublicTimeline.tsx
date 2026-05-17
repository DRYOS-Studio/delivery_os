import { CalendarDays, Gavel } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import type {
  PublicDecisionItem,
  PublicMeetingItem,
} from "@/lib/db/queries/public";
import { relativeFromNow } from "@/lib/utils/date";
import { formatDateTimeBR } from "@/lib/utils/datetime";

type TimelineItemData =
  | { type: "meeting"; timestamp: string; payload: PublicMeetingItem }
  | { type: "decision"; timestamp: string; payload: PublicDecisionItem };

const LIMIT = 12;

function truncate(s: string | null | undefined, n = 200): string {
  if (!s) return "";
  const cleaned = s.trim().replace(/\s+/g, " ");
  if (cleaned.length <= n) return cleaned;
  return `${cleaned.slice(0, n)}…`;
}

export function PublicTimeline({
  meetings,
  decisions,
}: {
  meetings: PublicMeetingItem[];
  decisions: PublicDecisionItem[];
}): React.JSX.Element {
  const items: TimelineItemData[] = [
    ...meetings.map(
      (m): TimelineItemData => ({
        type: "meeting",
        timestamp: m.scheduledAt,
        payload: m,
      }),
    ),
    ...decisions.map(
      (d): TimelineItemData => ({
        type: "decision",
        timestamp: d.decidedAt,
        payload: d,
      }),
    ),
  ].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const visible = items.slice(0, LIMIT);

  return (
    <section className="mb-9">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-display text-lg text-ink font-semibold">
          Reuniões e decisões
        </h2>
        <Pill variant="neutral">{items.length}</Pill>
      </div>

      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-mute text-center py-2">
            Nenhuma reunião ou decisão pública registrada ainda.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => (
            <TimelineItem
              key={`${item.type}-${item.payload.id}`}
              item={item}
            />
          ))}
          {items.length > LIMIT && (
            <li className="text-xs text-mute font-mono">
              Mostrando {LIMIT} de {items.length}.
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function TimelineItem({ item }: { item: TimelineItemData }) {
  const Icon = item.type === "meeting" ? CalendarDays : Gavel;
  const title = item.payload.title;
  const body =
    item.type === "meeting"
      ? truncate(item.payload.notes)
      : truncate(
          item.payload.decision +
            (item.payload.context ? `\n\n${item.payload.context}` : ""),
        );

  return (
    <li>
      <Card>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded bg-surface flex items-center justify-center text-mute">
            <Icon className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display text-base font-semibold text-ink">
                {title}
              </span>
              <Pill variant="neutral">
                {item.type === "meeting" ? "Reunião" : "Decisão"}
              </Pill>
            </div>
            <p className="font-mono text-[11px] text-mute">
              {formatDateTimeBR(item.timestamp)} ·{" "}
              {relativeFromNow(item.timestamp)}
            </p>
            {body && (
              <p className="text-sm text-ink-soft whitespace-pre-wrap">
                {body}
              </p>
            )}
          </div>
        </div>
      </Card>
    </li>
  );
}
